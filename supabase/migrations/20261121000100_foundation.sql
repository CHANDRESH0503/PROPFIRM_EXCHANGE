-- Phase 0 foundation: identity, staff roles, feature flags, geo rules, settings,
-- audit log and durable rate limits.
--
-- Conventions (CLAUDE.md §4, docs/SYSTEM_DESIGN.md §3):
--   * RLS on every table, default deny, explicit policies.
--   * Table privileges are granted explicitly; nothing relies on Supabase's default grants.
--   * SECURITY DEFINER functions pin search_path = '' and have EXECUTE revoked from PUBLIC.
--   * Helper functions that must not be reachable through the Data API live in schema `private`.

create schema if not exists private;
revoke all on schema private from public;
-- authenticated needs usage only so RLS policies can call private.has_role().
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------

create function private.forbid_mutation() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% on %.% is not allowed: table is append-only', tg_op, tg_table_schema, tg_table_name
    using errcode = '42501';
end;
$$;

create function private.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Unambiguous alphabet (no 0/O, 1/I/L). md5 of a v4 UUID spreads the random bits over every byte.
create function private.random_code(p_len int default 8) returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := decode(md5(gen_random_uuid()::text), 'hex');
  result text := '';
begin
  if p_len < 1 or p_len > 16 then
    raise exception 'random_code length must be 1..16';
  end if;
  for i in 0 .. p_len - 1 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return result;
end;
$$;

revoke execute on function private.random_code(int) from public;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.admin_role as enum ('owner', 'finance', 'support', 'content');
create type public.asset_class as enum ('forex', 'cfd', 'futures', 'crypto', 'stocks', 'options');
create type public.geo_action as enum ('block');

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 2 and 32),
  country_code char(2) check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  timezone text check (timezone is null or char_length(timezone) <= 64),
  age_confirmed_at timestamptz,
  onboarded_at timestamptz,
  referral_code text not null unique check (referral_code ~ '^[A-Z0-9]{6,16}$'),
  referred_by uuid references public.profiles (id) on delete set null,
  risk_score integer not null default 0,
  telegram_chat_id bigint unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_onboarding_complete check (
    onboarded_at is null
    or (country_code is not null and timezone is not null and age_confirmed_at is not null)
  ),
  constraint profiles_no_self_referral check (referred_by is null or referred_by <> id)
);

create index profiles_referred_by_idx on public.profiles (referred_by);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

-- Create the profile when Supabase Auth creates a user. A referral code passed as
-- user metadata (`ref`) is recorded for attribution only; nothing is paid at sign-up (06-engagement.md).
create function private.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref text := upper(nullif(trim(new.raw_user_meta_data ->> 'ref'), ''));
  v_referrer uuid;
begin
  if v_ref is not null and v_ref ~ '^[A-Z0-9]{6,16}$' then
    select p.id into v_referrer from public.profiles p where p.referral_code = v_ref;
  end if;

  for attempt in 1 .. 5 loop
    insert into public.profiles (id, referral_code, referred_by)
    values (new.id, private.random_code(8), v_referrer)
    on conflict do nothing;
    if found or exists (select 1 from public.profiles where id = new.id) then
      return new;
    end if;
  end loop;
  raise exception 'could not allocate a referral code for user %', new.id;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Staff roles
-- ---------------------------------------------------------------------------

create table public.admin_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.admin_role not null,
  granted_by uuid,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- True when the current user holds `p_role`, or `owner` (owner implies every role).
-- With p_role null: true for any staff role.
create function private.has_role(p_role public.admin_role default null) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_roles r
    where r.user_id = (select auth.uid())
      and (p_role is null or r.role = 'owner' or r.role = p_role)
  );
$$;

revoke execute on function private.has_role(public.admin_role) from public;
grant execute on function private.has_role(public.admin_role) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Feature flags (economy numbers and switches live in the database, CLAUDE.md §4)
-- ---------------------------------------------------------------------------

create table public.feature_flags (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,62}$'),
  enabled boolean not null default false,
  description text not null check (char_length(description) between 5 and 500),
  is_public boolean not null default false,
  excluded_countries char(2)[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create trigger feature_flags_set_updated_at
before update on public.feature_flags
for each row execute function private.set_updated_at();

-- Chance-based features start switched off (CLAUDE.md §2.9). Do not change these defaults
-- without the owner's approval.
insert into public.feature_flags (key, enabled, description, is_public) values
  ('signups_open', true, 'New accounts can be created. When off, the site runs in waitlist-only mode.', true),
  ('waitlist_open', true, 'The public waitlist accepts new emails.', true),
  ('spins', false, 'Daily free spin. Chance-based: needs legal review per region before enabling.', true),
  ('draws', false, 'Weekly draw. Chance-based: needs legal review per region before enabling.', true),
  ('maintenance_mode', false, 'Show the maintenance page to everyone except staff.', true);

-- ---------------------------------------------------------------------------
-- Geo rules (enforced on the server, CLAUDE.md §2.10)
-- ---------------------------------------------------------------------------

create table public.geo_rules (
  id bigint generated always as identity primary key,
  country_code char(2) not null check (country_code ~ '^[A-Z]{2}$'),
  asset_class public.asset_class not null,
  action public.geo_action not null default 'block',
  reason text not null check (char_length(reason) between 5 and 500),
  source_url text,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (country_code, asset_class)
);

insert into public.geo_rules (country_code, asset_class, action, reason, source_url) values
  ('IN', 'forex', 'block', 'RBI warns against promoting unauthorised forex trading platforms. Owner to confirm after legal review.', 'https://www.rbi.org.in/'),
  ('IN', 'cfd', 'block', 'RBI warns against promoting unauthorised forex/CFD trading platforms. Owner to confirm after legal review.', 'https://www.rbi.org.in/');

-- ---------------------------------------------------------------------------
-- Site settings (one row per key; brand overrides, waitlist rules, maintenance message)
-- ---------------------------------------------------------------------------

create table public.site_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_.]{1,62}$'),
  value jsonb not null,
  is_public boolean not null default false,
  description text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create trigger site_settings_set_updated_at
before update on public.site_settings
for each row execute function private.set_updated_at();

insert into public.site_settings (key, value, is_public, description) values
  ('waitlist.referral_boost', '5'::jsonb, true, 'Places a waitlist member moves up for each confirmed referral.');

-- ---------------------------------------------------------------------------
-- Audit log (append-only; who, when, before, after)
-- actor_id has no foreign key on purpose: deleting a user must not rewrite history.
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null check (action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  entity_type text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  reason text check (reason is null or char_length(reason) <= 1000),
  request_id text,
  created_at timestamptz not null default now()
);

create index audit_log_created_at_idx on public.audit_log (created_at desc);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index audit_log_actor_idx on public.audit_log (actor_id);

create trigger audit_log_append_only
before update or delete on public.audit_log
for each row execute function private.forbid_mutation();

create trigger audit_log_no_truncate
before truncate on public.audit_log
for each statement execute function private.forbid_mutation();

create function private.write_audit(
  p_actor uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_before jsonb,
  p_after jsonb,
  p_reason text,
  p_request_id text
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, entity_type, entity_id, before, after, reason, request_id)
  values (p_actor, p_action, p_entity_type, p_entity_id, p_before, p_after, p_reason, p_request_id);
$$;

revoke execute on function private.write_audit(uuid, text, text, text, jsonb, jsonb, text, text) from public, anon, authenticated;
grant execute on function private.write_audit(uuid, text, text, text, jsonb, jsonb, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Durable rate limits (fixed window). Unlogged: losing counters on a crash is acceptable.
-- ---------------------------------------------------------------------------

create unlogged table private.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 1,
  primary key (key, window_start)
);

-- Returns true when the call is within the limit.
create function public.rate_limit_hit(p_key text, p_window_seconds integer, p_max integer) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_hits integer;
begin
  if p_window_seconds < 1 or p_max < 1 or char_length(p_key) > 200 then
    raise exception 'invalid rate limit arguments' using errcode = '22023';
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into private.rate_limits as r (key, window_start)
  values (p_key, v_window)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  return v_hits <= p_max;
end;
$$;

revoke execute on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

create function private.prune_rate_limits() returns integer
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from private.rate_limits where window_start < now() - interval '2 days' returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke execute on function private.prune_rate_limits() from public, anon, authenticated;
grant execute on function private.prune_rate_limits() to service_role;

-- ---------------------------------------------------------------------------
-- Onboarding (country, timezone, 18+). Runs as the signed-in user.
-- Country is set once; changing it later is a support action, so it cannot be used to dodge geo rules.
-- ---------------------------------------------------------------------------

create function public.complete_onboarding(p_country text, p_timezone text, p_is_adult boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_is_adult is not true then
    raise exception 'age_confirmation_required' using errcode = '22023';
  end if;
  if p_country is null or p_country !~ '^[A-Z]{2}$' then
    raise exception 'invalid_country' using errcode = '22023';
  end if;
  if p_timezone is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'invalid_timezone' using errcode = '22023';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;
  if v_profile.onboarded_at is not null then
    raise exception 'already_onboarded' using errcode = '23505';
  end if;

  update public.profiles
  set country_code = p_country,
      timezone = p_timezone,
      age_confirmed_at = now(),
      onboarded_at = now()
  where id = v_uid;
end;
$$;

revoke execute on function public.complete_onboarding(text, text, boolean) from public, anon;
grant execute on function public.complete_onboarding(text, text, boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Admin: feature flags (owner only, audited). Called by the server with the service role;
-- the actor's role is re-checked here so a server bug cannot skip it.
-- ---------------------------------------------------------------------------

create function public.admin_set_feature_flag(
  p_actor uuid,
  p_key text,
  p_enabled boolean,
  p_reason text,
  p_request_id text default null
) returns public.feature_flags
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.feature_flags%rowtype;
  v_after public.feature_flags%rowtype;
begin
  if not exists (select 1 from public.admin_roles where user_id = p_actor and role = 'owner') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 5 then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  select * into v_before from public.feature_flags where key = p_key for update;
  if not found then
    raise exception 'unknown_flag' using errcode = 'P0002';
  end if;

  update public.feature_flags
  set enabled = p_enabled, updated_by = p_actor
  where key = p_key
  returning * into v_after;

  perform private.write_audit(
    p_actor, 'feature_flag.update', 'feature_flag', p_key,
    to_jsonb(v_before), to_jsonb(v_after), trim(p_reason), p_request_id
  );
  return v_after;
end;
$$;

revoke execute on function public.admin_set_feature_flag(uuid, text, boolean, text, text) from public, anon, authenticated;
grant execute on function public.admin_set_feature_flag(uuid, text, boolean, text, text) to service_role;

-- Grant or revoke a staff role (owner only, audited). Bootstrap the first owner with
-- `pnpm admin:grant <email> owner`, which calls private.bootstrap_owner as the database owner.
create function public.admin_set_role(
  p_actor uuid,
  p_user uuid,
  p_role public.admin_role,
  p_grant boolean,
  p_reason text,
  p_request_id text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.admin_roles where user_id = p_actor and role = 'owner') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 5 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if p_actor = p_user and p_role = 'owner' and not p_grant then
    raise exception 'cannot_remove_own_owner_role' using errcode = '42501';
  end if;

  if p_grant then
    insert into public.admin_roles (user_id, role, granted_by) values (p_user, p_role, p_actor)
    on conflict do nothing;
  else
    delete from public.admin_roles where user_id = p_user and role = p_role;
  end if;

  perform private.write_audit(
    p_actor, case when p_grant then 'admin_role.grant' else 'admin_role.revoke' end,
    'profile', p_user::text, null, jsonb_build_object('role', p_role), trim(p_reason), p_request_id
  );
end;
$$;

revoke execute on function public.admin_set_role(uuid, uuid, public.admin_role, boolean, text, text) from public, anon, authenticated;
grant execute on function public.admin_set_role(uuid, uuid, public.admin_role, boolean, text, text) to service_role;

create function private.bootstrap_owner(p_email text) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(p_email);
  if v_user is null then
    raise exception 'no auth user with that email; sign in once first' using errcode = 'P0002';
  end if;
  insert into public.admin_roles (user_id, role, granted_by) values (v_user, 'owner', null)
  on conflict do nothing;
  perform private.write_audit(null, 'admin_role.bootstrap', 'profile', v_user::text, null,
    jsonb_build_object('role', 'owner'), 'bootstrap from CLI', null);
  return v_user;
end;
$$;

revoke execute on function private.bootstrap_owner(text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.admin_roles enable row level security;
alter table public.feature_flags enable row level security;
alter table public.geo_rules enable row level security;
alter table public.site_settings enable row level security;
alter table public.audit_log enable row level security;

revoke all on public.profiles, public.admin_roles, public.feature_flags, public.geo_rules,
  public.site_settings, public.audit_log from anon, authenticated;
grant all on public.profiles, public.admin_roles, public.feature_flags, public.geo_rules,
  public.site_settings, public.audit_log to service_role;
revoke all on private.rate_limits from public, anon, authenticated;
grant all on private.rate_limits to service_role;

-- profiles: users read their own row (not fraud or internal columns) and may change only
-- their display name. Staff screens read through the service role.
grant select (id, display_name, country_code, timezone, age_confirmed_at, onboarded_at,
  referral_code, created_at, updated_at) on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- admin_roles: a user can see their own roles (to show the admin link); the owner sees all.
grant select on public.admin_roles to authenticated;

create policy admin_roles_select_own on public.admin_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_role('owner')));

-- feature_flags: public flags are readable by everyone; staff read all.
grant select on public.feature_flags to anon, authenticated;

create policy feature_flags_select_public on public.feature_flags
  for select to anon, authenticated
  using (is_public);

create policy feature_flags_select_staff on public.feature_flags
  for select to authenticated
  using ((select private.has_role()));

-- geo_rules: staff only. The server evaluates them with the service role.
grant select on public.geo_rules to authenticated;

create policy geo_rules_select_staff on public.geo_rules
  for select to authenticated
  using ((select private.has_role()));

-- site_settings: public keys readable by everyone; staff read all.
grant select on public.site_settings to anon, authenticated;

create policy site_settings_select_public on public.site_settings
  for select to anon, authenticated
  using (is_public);

create policy site_settings_select_staff on public.site_settings
  for select to authenticated
  using ((select private.has_role()));

-- audit_log: staff read; nobody writes except through private.write_audit.
grant select on public.audit_log to authenticated;

create policy audit_log_select_staff on public.audit_log
  for select to authenticated
  using ((select private.has_role()));
