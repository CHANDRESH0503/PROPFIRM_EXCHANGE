-- Owner operational alerts (09-admin.md §22, 05-economy.md liability rule).
--
-- `ops_alert_conditions()` computes what is wrong right now. `sync_ops_alerts()` compares that
-- with the stored state and returns only transitions (opened / resolved), so the minute job sends
-- one message when a condition starts and one when it clears, never one per minute. The admin
-- dashboard lists open alerts from the same table.

create table public.ops_alerts (
  key text primary key check (length(key) between 1 and 120),
  kind text not null check (kind in ('liability', 'claims_waiting', 'redemption_overdue', 'low_stock')),
  detail jsonb not null default '{}',
  active boolean not null,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);
create index ops_alerts_open on public.ops_alerts (opened_at) where active;

alter table public.ops_alerts enable row level security;
-- Default deny: no policies. Only the server (service role) reads or writes alerts.
revoke all on public.ops_alerts from public, anon, authenticated;
grant select on public.ops_alerts to service_role;

/*
 * Current conditions, one row per open problem:
 *  - liability: outstanding Coins exceed confirmed commission (ratio above 1.0).
 *  - claims_waiting: a claim has waited for review for more than 24 hours.
 *  - redemption_overdue: a queued redemption has passed its fulfilment target.
 *  - low_stock:<reward>: an active voucher reward has no more unexpired codes than its threshold.
 */
create function public.ops_alert_conditions()
returns table (key text, kind text, detail jsonb)
language sql stable security definer set search_path = '' as $$
  select 'liability', 'liability',
         jsonb_build_object('ratio', round(f.liability_ratio::numeric, 3))
  from public.finance_totals f
  where f.liability_ratio > 1.0
  union all
  select 'claims_waiting', 'claims_waiting',
         jsonb_build_object('count', count(*), 'oldest', min(c.created_at))
  from public.purchase_claims c
  where c.status in ('submitted', 'needs_info', 'flagged')
    and c.created_at < now() - interval '24 hours'
  having count(*) > 0
  union all
  select 'redemption_overdue', 'redemption_overdue',
         jsonb_build_object('count', count(*), 'oldest_target', min(r.target_at))
  from public.redemptions r
  where r.status = 'pending' and r.target_at < now()
  having count(*) > 0
  union all
  select 'low_stock:' || w.id, 'low_stock',
         jsonb_build_object('reward', w.id, 'name', w.name, 'remaining', s.remaining,
                            'threshold', w.low_stock)
  from public.rewards w
  cross join lateral (
    select count(*)::integer as remaining
    from public.voucher_inventory v
    where v.reward_id = w.id and v.redemption_id is null
      and (v.expires_at is null or v.expires_at > now())
  ) s
  where w.active and w.kind <> 'booster' and s.remaining <= w.low_stock;
$$;

/*
 * Applies the current conditions to the stored state and returns what changed: 'opened' for a
 * condition that was not active before, 'resolved' for one that has cleared. Concurrent runs are
 * serialised by a transaction advisory lock, so each transition is reported by exactly one caller.
 */
create function public.sync_ops_alerts()
returns table (key text, kind text, detail jsonb, transition text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  was_active text[];
begin
  perform pg_advisory_xact_lock(hashtext('public.sync_ops_alerts'));
  select coalesce(array_agg(a.key), '{}') into was_active from public.ops_alerts a where a.active;

  return query
  with now_open as (
    select * from public.ops_alert_conditions()
  ),
  upserted as (
    insert into public.ops_alerts as a (key, kind, detail, active, opened_at, resolved_at, updated_at)
    select o.key, o.kind, o.detail, true, now(), null, now() from now_open o
    on conflict on constraint ops_alerts_pkey do update
      set detail = excluded.detail, active = true, resolved_at = null, updated_at = now(),
          opened_at = case when a.active then a.opened_at else now() end
    returning a.key, a.kind, a.detail
  ),
  cleared as (
    update public.ops_alerts a
    set active = false, resolved_at = now(), updated_at = now()
    where a.active and a.key not in (select o.key from now_open o)
    returning a.key, a.kind, a.detail
  )
  select u.key, u.kind, u.detail, 'opened'::text from upserted u where u.key <> all (was_active)
  union all
  select c.key, c.kind, c.detail, 'resolved'::text from cleared c;
end;
$$;

revoke execute on function public.ops_alert_conditions(), public.sync_ops_alerts()
  from public, anon, authenticated;
grant execute on function public.ops_alert_conditions(), public.sync_ops_alerts() to service_role;
