-- Guided weekly journal review (15-trading-journal.md "Weekly review").
--
-- Each member picks a review day (default Sunday). On that day the review for the week
-- (Monday to Sunday, in the member's timezone) that contains it opens: the week's stats, best
-- and worst trades, five short questions and one rule for next week. The rule is shown on Today
-- all next week, and the next review asks whether it was kept.
--
-- XP: 100 for a completed review, once per week (05-economy.md). Like weekly missions it is
-- outside the daily engagement cap. Never Coins.

alter table public.profiles
  add column journal_review_day smallint not null default 0 check (journal_review_day between 0 and 6);
comment on column public.profiles.journal_review_day is '0 = Sunday … 6 = Saturday (PostgreSQL dow).';

create table public.journal_reviews (
  user_id uuid not null references public.profiles on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  what_worked text not null default '' check (length(what_worked) <= 1000),
  what_didnt text not null default '' check (length(what_didnt) <= 1000),
  costly_mistake text not null default '' check (length(costly_mistake) <= 1000),
  followed_plan text not null check (followed_plan in ('yes', 'partly', 'no')),
  feeling smallint not null check (feeling between 1 and 5),
  next_rule text check (next_rule is null or length(trim(next_rule)) between 1 and 200),
  previous_rule_kept boolean,
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

alter table public.journal_reviews enable row level security;
create policy journal_reviews_owner_read on public.journal_reviews
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.journal_reviews from public, anon, authenticated;
grant select on public.journal_reviews to authenticated, service_role;

/*
 * The Monday of the week under review for a member right now: the week containing the most
 * recent review day on or before today, in the member's timezone.
 */
create function private.journal_review_week(p_user uuid, p_now timestamptz) returns date
language sql stable security definer set search_path = '' as $$
  select (date_trunc('week', (d - ((extract(dow from d)::int - p.journal_review_day + 7) % 7))::timestamp))::date
  from public.profiles p
  cross join lateral (select private.local_day(p_now, p.timezone) as d) today
  where p.id = p_user and p.onboarded_at is not null;
$$;

create function public.journal_review_week(p_user uuid) returns date
language sql stable security definer set search_path = '' as $$
  select private.journal_review_week(p_user, now());
$$;

create function public.set_journal_review_day(p_user uuid, p_day smallint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_day is null or p_day not between 0 and 6 then
    raise exception 'review day must be 0-6' using errcode = '22023';
  end if;
  update public.profiles set journal_review_day = p_day where id = p_user and onboarded_at is not null;
  if not found then raise exception 'profile not found' using errcode = 'P0002'; end if;
end;
$$;

/*
 * Saves (or edits) the review for the current review week. The first save of a week awards
 * 100 XP; edits never award again. Returns the XP awarded by this call.
 */
create function public.save_journal_review(
  p_user uuid,
  p_week date,
  p_what_worked text,
  p_what_didnt text,
  p_costly_mistake text,
  p_followed_plan text,
  p_feeling smallint,
  p_next_rule text,
  p_previous_rule_kept boolean
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  week date;
  awarded integer := 0;
  total integer;
  had_previous_rule boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  week := private.journal_review_week(p_user, now());
  if week is null then raise exception 'profile not found' using errcode = 'P0002'; end if;
  if p_week is distinct from week then
    raise exception 'only the current review week can be saved' using errcode = '22023';
  end if;

  select next_rule is not null into had_previous_rule
  from public.journal_reviews where user_id = p_user and week_start = week - 7;

  insert into public.journal_reviews as r (
    user_id, week_start, what_worked, what_didnt, costly_mistake, followed_plan, feeling,
    next_rule, previous_rule_kept
  ) values (
    p_user, week, trim(coalesce(p_what_worked, '')), trim(coalesce(p_what_didnt, '')),
    trim(coalesce(p_costly_mistake, '')), p_followed_plan, p_feeling,
    nullif(trim(coalesce(p_next_rule, '')), ''),
    case when coalesce(had_previous_rule, false) then p_previous_rule_kept end
  )
  on conflict (user_id, week_start) do update set
    what_worked = excluded.what_worked, what_didnt = excluded.what_didnt,
    costly_mistake = excluded.costly_mistake, followed_plan = excluded.followed_plan,
    feeling = excluded.feeling, next_rule = excluded.next_rule,
    previous_rule_kept = excluded.previous_rule_kept, updated_at = now();

  insert into public.xp_events (user_id, amount, source, idempotency_key)
  values (p_user, 100, 'journal_review', 'journal:review:' || p_user || ':' || week)
  on conflict (idempotency_key) do nothing;
  if found then awarded := 100; end if;

  select count(*) into total from public.journal_reviews where user_id = p_user;
  if total >= 8 then
    insert into public.user_badges (user_id, badge) values (p_user, 'journal_reviewer') on conflict do nothing;
  end if;
  perform public.record_mission_event(p_user, 'journal_review_done');
  return awarded;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Reminder: an in-app notification (copied to email, Telegram and push by the dispatcher) at
-- 18:00 local time on the review day, once per week, only for members who journaled in the
-- last 14 days and have not reviewed yet. Members can switch it off in Notifications.
-- ---------------------------------------------------------------------------------------------
alter table public.notification_prefs add column journal_review boolean not null default true;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
 'claim_status', 'redemption_status', 'coins_released', 'coins_adjusted', 'coins_expiring', 'coins_expired',
 'support_reply', 'appeal_decided', 'data_request', 'draw_won', 'journal_review'));

create or replace function private.deliver_in_app(p_user uuid, p_kind text, p_key text, p_detail text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, event_key, detail)
  select p_user, p_kind, p_key, p_detail where p_user is not null and coalesce((
    select case p_kind
      when 'claim_status' then p.claim_status
      when 'redemption_status' then p.redemption_status
      when 'coins_released' then p.coins_released
      when 'journal_review' then p.journal_review
    end
    from public.notification_prefs p where p.user_id = p_user
  ), true) on conflict (user_id, kind, event_key) do nothing;
$$;

create function public.queue_journal_review_reminders(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; sent integer := 0;
begin
  for r in
    select p.id, private.journal_review_week(p.id, p_now) as week
    from public.profiles p
    where p.onboarded_at is not null
      and extract(dow from (p_now at time zone p.timezone)) = p.journal_review_day
      and extract(hour from (p_now at time zone p.timezone)) >= 18
      and exists (
        select 1 from public.journal_trades t
        where t.user_id = p.id and t.closed_at > p_now - interval '14 days'
      )
  loop
    if not exists (select 1 from public.journal_reviews v where v.user_id = r.id and v.week_start = r.week) then
      perform private.deliver_in_app(r.id, 'journal_review', r.week::text, r.week::text);
      sent := sent + 1;
    end if;
  end loop;
  return sent;
end;
$$;

revoke execute on function
  public.journal_review_week(uuid), public.set_journal_review_day(uuid, smallint),
  public.save_journal_review(uuid, date, text, text, text, text, smallint, text, boolean),
  public.queue_journal_review_reminders(timestamptz)
  from public, anon, authenticated;
grant execute on function
  public.journal_review_week(uuid), public.set_journal_review_day(uuid, smallint),
  public.save_journal_review(uuid, date, text, text, text, text, smallint, text, boolean),
  public.queue_journal_review_reminders(timestamptz)
  to service_role;
revoke execute on function private.journal_review_week(uuid, timestamptz) from public, anon, authenticated;
