-- Public waitlist: email capture, a personal referral link, and a position that moves up
-- for each confirmed referral (14-build-order.md, Phase 0).
--
-- Access model: no client role can touch these tables. The server calls the functions below
-- with the service role. A waitlist member proves who they are with a random access token
-- sent by email; only its SHA-256 hash is stored.

create type public.waitlist_status as enum ('pending', 'confirmed');

create table public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity unique,
  email text not null unique
    check (email = lower(email) and char_length(email) between 3 and 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  status public.waitlist_status not null default 'pending',
  referral_code text not null unique check (referral_code ~ '^[A-Z0-9]{6,16}$'),
  referred_by uuid references public.waitlist_signups (id) on delete set null,
  -- Set when this signup confirms: whether it counts toward its referrer's position.
  referral_counted boolean not null default false,
  confirmed_referrals integer not null default 0 check (confirmed_referrals >= 0),
  access_token_hash text not null unique check (access_token_hash ~ '^[0-9a-f]{64}$'),
  token_issued_at timestamptz not null default now(),
  ip_hash text check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  country_code char(2) check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  source text check (source is null or char_length(source) <= 64),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  constraint waitlist_confirmed_has_time check ((status = 'confirmed') = (confirmed_at is not null)),
  constraint waitlist_no_self_referral check (referred_by is null or referred_by <> id)
);

create index waitlist_signups_referred_by_idx on public.waitlist_signups (referred_by);
create index waitlist_signups_status_seq_idx on public.waitlist_signups (status, seq);
create index waitlist_signups_created_at_idx on public.waitlist_signups (created_at desc);

alter table public.waitlist_signups enable row level security;
revoke all on public.waitlist_signups from anon, authenticated;
grant all on public.waitlist_signups to service_role;
grant select on public.waitlist_signups to authenticated;

create policy waitlist_select_staff on public.waitlist_signups
  for select to authenticated
  using ((select private.has_role('support')));

-- ---------------------------------------------------------------------------
-- Position: confirmed members ordered by score = seq - boost * confirmed_referrals.
-- Pending members have no position until they confirm.
-- ---------------------------------------------------------------------------

create function private.waitlist_boost() returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::integer from public.site_settings where key = 'waitlist.referral_boost'), 5);
$$;

revoke execute on function private.waitlist_boost() from public, anon, authenticated;

create type public.waitlist_member as (
  signup_id uuid,
  status public.waitlist_status,
  referral_code text,
  confirmed_referrals integer,
  position bigint,
  total_confirmed bigint
);

create function private.waitlist_view_for(p_id uuid) returns public.waitlist_member
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.waitlist_signups%rowtype;
  v_boost integer := private.waitlist_boost();
  v_result public.waitlist_member;
begin
  select * into v from public.waitlist_signups where id = p_id;
  if not found then
    return null;
  end if;

  v_result.signup_id := v.id;
  v_result.status := v.status;
  v_result.referral_code := v.referral_code;
  v_result.confirmed_referrals := v.confirmed_referrals;
  select count(*) into v_result.total_confirmed from public.waitlist_signups where status = 'confirmed';

  if v.status = 'confirmed' then
    select count(*) + 1 into v_result.position
    from public.waitlist_signups w
    where w.status = 'confirmed'
      -- Lower score first; on a tie the member with more referrals has earned the place.
      and (w.seq - v_boost * w.confirmed_referrals, -w.confirmed_referrals, w.seq)
        < (v.seq - v_boost * v.confirmed_referrals, -v.confirmed_referrals, v.seq);
  end if;
  return v_result;
end;
$$;

revoke execute on function private.waitlist_view_for(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Join. Idempotent on email: a repeat join rotates the access token (so a fresh link can be
-- emailed) and never reveals whether the email was already present to the caller's UI.
-- ---------------------------------------------------------------------------

create function public.waitlist_join(
  p_email text,
  p_referral_code text,
  p_token_hash text,
  p_ip_hash text,
  p_country text,
  p_source text
) returns table (signup_id uuid, is_new boolean, status public.waitlist_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_existing public.waitlist_signups%rowtype;
  v_referrer uuid;
  v_id uuid;
begin
  select * into v_existing from public.waitlist_signups w where w.email = v_email for update;
  if found then
    update public.waitlist_signups
    set access_token_hash = p_token_hash, token_issued_at = now()
    where id = v_existing.id;
    return query select v_existing.id, false, v_existing.status;
    return;
  end if;

  if p_referral_code is not null then
    select w.id into v_referrer from public.waitlist_signups w where w.referral_code = upper(trim(p_referral_code));
  end if;

  for attempt in 1 .. 5 loop
    begin
      insert into public.waitlist_signups (email, referral_code, referred_by, access_token_hash, ip_hash, country_code, source)
      values (v_email, private.random_code(8), v_referrer, p_token_hash, p_ip_hash, p_country, nullif(trim(p_source), ''))
      returning id into v_id;
      return query select v_id, true, 'pending'::public.waitlist_status;
      return;
    exception when unique_violation then
      -- A concurrent join for the same email wins; otherwise the referral code collided: retry.
      if exists (select 1 from public.waitlist_signups w where w.email = v_email) then
        update public.waitlist_signups
        set access_token_hash = p_token_hash, token_issued_at = now()
        where email = v_email
        returning id into v_id;
        return query select v_id, false, (select w.status from public.waitlist_signups w where w.id = v_id);
        return;
      end if;
    end;
  end loop;
  raise exception 'could not allocate a waitlist referral code';
end;
$$;

revoke execute on function public.waitlist_join(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.waitlist_join(text, text, text, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Open the member's page with their token. The first open confirms the email and,
-- if the member was referred, counts the referral for the referrer, unless both
-- signups came from the same network (same IP hash), a cheap anti-farming signal.
-- ---------------------------------------------------------------------------

create function public.waitlist_open(p_token_hash text) returns public.waitlist_member
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.waitlist_signups%rowtype;
  v_referrer public.waitlist_signups%rowtype;
  v_counts boolean := false;
begin
  select * into v from public.waitlist_signups where access_token_hash = p_token_hash for update;
  if not found then
    return null;
  end if;

  if v.status = 'pending' then
    if v.referred_by is not null then
      select * into v_referrer from public.waitlist_signups where id = v.referred_by for update;
      v_counts := found
        and v.ip_hash is not null
        and v_referrer.ip_hash is distinct from v.ip_hash;
      if v_counts then
        update public.waitlist_signups
        set confirmed_referrals = confirmed_referrals + 1
        where id = v_referrer.id;
      end if;
    end if;

    update public.waitlist_signups
    set status = 'confirmed', confirmed_at = now(), referral_counted = v_counts
    where id = v.id;
  end if;

  return private.waitlist_view_for(v.id);
end;
$$;

revoke execute on function public.waitlist_open(text) from public, anon, authenticated;
grant execute on function public.waitlist_open(text) to service_role;
