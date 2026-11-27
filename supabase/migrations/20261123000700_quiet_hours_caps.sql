-- Quiet hours and a daily frequency cap for notifications sent outside the app
-- (08-notifications.md: "quiet hours in their timezone and a frequency cap. Transactional
-- messages about money are on by default").
--
-- The in-app inbox always receives every notification. The rules apply to the copies sent by
-- email, Telegram and push:
--   * Quiet hours (member's timezone): nothing leaves during the window; it is sent when the
--     window ends. Windows may wrap midnight (22 → 7).
--   * Daily cap: at most N non-transactional messages per local day go out; the rest stay in the
--     inbox only. Transactional kinds (money, claims, rewards, account and support) are never capped.

alter table public.notification_prefs
  add column quiet_start smallint check (quiet_start between 0 and 23),
  add column quiet_end smallint check (quiet_end between 0 and 23),
  add column daily_cap smallint check (daily_cap between 1 and 50),
  add constraint notification_prefs_quiet_pair check (
    (quiet_start is null and quiet_end is null)
    or (quiet_start is not null and quiet_end is not null and quiet_start <> quiet_end)
  );

-- True when a capped notification was kept in the inbox only.
alter table public.notifications add column external_suppressed boolean not null default false;

create function private.is_transactional(p_kind text) returns boolean
language sql immutable set search_path = '' as $$
  select p_kind in (
    'claim_status', 'redemption_status', 'coins_released', 'coins_adjusted', 'coins_expiring',
    'coins_expired', 'support_reply', 'appeal_decided', 'data_request'
  );
$$;

create function private.in_quiet_hours(p_user uuid, p_now timestamptz) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when q.quiet_start < q.quiet_end then h >= q.quiet_start and h < q.quiet_end
      else h >= q.quiet_start or h < q.quiet_end
    end
    from public.notification_prefs q
    join public.profiles p on p.id = q.user_id
    cross join lateral (select extract(hour from (p_now at time zone p.timezone))::int as h) local
    where q.user_id = p_user and q.quiet_start is not null
  ), false);
$$;

/*
 * Claims a batch for external delivery. Notifications of members inside quiet hours are left
 * for a later run. `external` is false for a capped notification: it stays in the inbox and
 * the dispatcher sends nothing.
 */
drop function public.claim_notification_batch(integer);
create function public.claim_notification_batch(p_limit integer, p_now timestamptz default now())
returns table (id bigint, user_id uuid, kind text, detail text, external boolean)
language plpgsql security definer set search_path = '' as $$
declare
  n record;
  cap smallint;
  zone text;
  used integer;
begin
  -- Anything older than a day is no longer timely: mark it handled without sending.
  update public.notifications x set dispatched_at = p_now
  where x.dispatched_at is null and x.created_at < p_now - interval '1 day';

  for n in
    select x.id, x.user_id, x.kind, x.detail
    from public.notifications x
    where x.dispatched_at is null and not private.in_quiet_hours(x.user_id, p_now)
    order by x.id
    limit least(greatest(p_limit, 1), 500)
    for update of x skip locked
  loop
    external := true;
    if not private.is_transactional(n.kind) then
      select q.daily_cap, p.timezone into cap, zone
      from public.profiles p left join public.notification_prefs q on q.user_id = p.id
      where p.id = n.user_id;
      if cap is not null then
        select count(*) into used from public.notifications s
        where s.user_id = n.user_id and s.dispatched_at is not null and not s.external_suppressed
          and not private.is_transactional(s.kind)
          and s.dispatched_at >= ((p_now at time zone zone)::date)::timestamp at time zone zone;
        external := used < cap;
      end if;
    end if;
    update public.notifications x
    set dispatched_at = p_now, external_suppressed = not external
    where x.id = n.id;
    id := n.id; user_id := n.user_id; kind := n.kind; detail := n.detail;
    return next;
  end loop;
end;
$$;

-- Preferences: the toggles plus quiet hours and the daily cap.
drop function public.set_inbox_preferences(uuid, boolean, boolean, boolean, boolean);
create function public.set_inbox_preferences(
  p_user uuid, p_claim boolean, p_redemption boolean, p_release boolean,
  p_journal_review boolean default true,
  p_quiet_start smallint default null, p_quiet_end smallint default null,
  p_daily_cap smallint default null
) returns void language sql security definer set search_path = '' as $$
  insert into public.notification_prefs (
    user_id, claim_status, redemption_status, coins_released, journal_review,
    quiet_start, quiet_end, daily_cap
  ) values (
    p_user, p_claim, p_redemption, p_release, p_journal_review,
    p_quiet_start, p_quiet_end, p_daily_cap
  )
  on conflict (user_id) do update set
    claim_status = excluded.claim_status, redemption_status = excluded.redemption_status,
    coins_released = excluded.coins_released, journal_review = excluded.journal_review,
    quiet_start = excluded.quiet_start, quiet_end = excluded.quiet_end,
    daily_cap = excluded.daily_cap;
$$;

revoke execute on function
  public.claim_notification_batch(integer, timestamptz),
  public.set_inbox_preferences(uuid, boolean, boolean, boolean, boolean, smallint, smallint, smallint)
  from public, anon, authenticated;
grant execute on function
  public.claim_notification_batch(integer, timestamptz),
  public.set_inbox_preferences(uuid, boolean, boolean, boolean, boolean, smallint, smallint, smallint)
  to service_role;
revoke execute on function private.in_quiet_hours(uuid, timestamptz) from public, anon, authenticated;

-- Members read their own quiet hours and cap with the other preferences.
grant select (quiet_start, quiet_end, daily_cap) on public.notification_prefs to authenticated;
