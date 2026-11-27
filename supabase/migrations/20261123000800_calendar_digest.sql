-- Daily economic calendar digest (16-trader-tools.md "Alerts": a daily morning digest of
-- today's high-impact events for the member's currencies, at a time they choose).
--
-- Opt-in. The minute job asks for members whose chosen local hour has arrived and who have not
-- had today's digest, sends it by email, and records the day so it is sent at most once.

create table public.calendar_digests (
  user_id uuid primary key references public.profiles on delete cascade,
  active boolean not null default true,
  currencies text[] not null check (
    cardinality(currencies) between 1 and 9
    and currencies <@ array['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'CNY']
  ),
  send_hour smallint not null default 7 check (send_hour between 0 and 23),
  last_sent_day date,
  updated_at timestamptz not null default now()
);
create index calendar_digests_due on public.calendar_digests (send_hour) where active;

alter table public.calendar_digests enable row level security;
create policy calendar_digests_owner_read on public.calendar_digests
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.calendar_digests from public, anon, authenticated;
grant select on public.calendar_digests to authenticated, service_role;

create function public.set_calendar_digest(
  p_user uuid, p_active boolean, p_currencies text[], p_send_hour smallint
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = p_user and onboarded_at is not null) then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;
  insert into public.calendar_digests (user_id, active, currencies, send_hour)
  values (p_user, p_active, (select array_agg(distinct c order by c) from unnest(p_currencies) c), p_send_hour)
  on conflict (user_id) do update set
    active = excluded.active, currencies = excluded.currencies,
    send_hour = excluded.send_hour, updated_at = now();
end;
$$;

/* Members due now: active, chosen local hour reached, not yet sent for their local today. */
create function public.due_calendar_digests(p_now timestamptz default now(), p_limit integer default 200)
returns table (user_id uuid, local_day date, timezone text, currencies text[])
language sql stable security definer set search_path = '' as $$
  select d.user_id, (p_now at time zone p.timezone)::date, p.timezone, d.currencies
  from public.calendar_digests d
  join public.profiles p on p.id = d.user_id and p.onboarded_at is not null
  where d.active
    and extract(hour from (p_now at time zone p.timezone)) >= d.send_hour
    and (d.last_sent_day is null or d.last_sent_day < (p_now at time zone p.timezone)::date)
  order by d.user_id
  limit least(greatest(p_limit, 1), 1000);
$$;

/* Records the day as handled. Returns false if another run already did (send nothing then). */
create function public.mark_calendar_digest_sent(p_user uuid, p_day date) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.calendar_digests set last_sent_day = p_day
  where user_id = p_user and (last_sent_day is null or last_sent_day < p_day);
  return found;
end;
$$;

revoke execute on function
  public.set_calendar_digest(uuid, boolean, text[], smallint),
  public.due_calendar_digests(timestamptz, integer),
  public.mark_calendar_digest_sent(uuid, date)
  from public, anon, authenticated;
grant execute on function
  public.set_calendar_digest(uuid, boolean, text[], smallint),
  public.due_calendar_digests(timestamptz, integer),
  public.mark_calendar_digest_sent(uuid, date)
  to service_role;
