-- Daily spin and weekly draw (06-engagement.md, 09-admin.md §11). CLAUDE.md §2.9: chance-based,
-- so both stay behind the `spins` and `draws` flags, which default to OFF; free to enter; never
-- tied to purchases; odds published; region exclusions honoured. CLAUDE.md §2.1: prizes are XP,
-- boosters, streak freezes and draw tickets, never Coins.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Uniform integer in [0, p_bound) from a cryptographic source, without modulo bias.
create function private.secure_random(p_bound bigint) returns table (value bigint, raw text)
language plpgsql volatile set search_path = '' as $$
declare bytes bytea; n bigint; limit_ bigint;
begin
 if p_bound is null or p_bound <= 0 or p_bound > 281474976710656 then raise exception 'invalid bound'; end if;
 -- 48-bit draws; reject the top slice that would bias the modulo.
 limit_ := 281474976710656 - (281474976710656 % p_bound);
 loop
   bytes := extensions.gen_random_bytes(6);
   n := (get_byte(bytes, 0)::bigint << 40) | (get_byte(bytes, 1)::bigint << 32) | (get_byte(bytes, 2)::bigint << 24)
      | (get_byte(bytes, 3)::bigint << 16) | (get_byte(bytes, 4)::bigint << 8) | get_byte(bytes, 5)::bigint;
   exit when n < limit_;
 end loop;
 return query select n % p_bound, encode(bytes, 'hex');
end;
$$;

-- Flag on, and neither the member's country nor the request's country is excluded.
create function private.chance_allowed(p_flag text, p_user uuid, p_ip_country text) returns boolean
language sql stable set search_path = '' as $$
 select coalesce((
  select f.enabled
   and not ((select country_code from public.profiles where id = p_user) = any (f.excluded_countries))
   and not (coalesce(upper(p_ip_country), '') = any (f.excluded_countries::text[]))
  from public.feature_flags f where f.key = p_flag), false);
$$;

-- ---------------------------------------------------------------------------------------------
-- Spin
-- ---------------------------------------------------------------------------------------------
create table public.spin_prizes (
 id uuid primary key default gen_random_uuid(),
 label text not null check (length(trim(label)) between 2 and 60),
 kind text not null check (kind in ('xp', 'xp_boost', 'freeze', 'ticket')),
 value integer not null check (value > 0 and value <= 500),
 -- Odds in parts per million; active prizes must add up to 1,000,000.
 odds_ppm integer not null check (odds_ppm between 0 and 1000000),
 daily_cap integer check (daily_cap > 0),
 active boolean not null default true,
 sort smallint not null default 0
);
insert into public.spin_prizes (label, kind, value, odds_ppm, daily_cap, sort) values
 ('10 XP', 'xp', 10, 500000, null, 1),
 ('25 XP', 'xp', 25, 250000, null, 2),
 ('50 XP', 'xp', 50, 100000, null, 3),
 ('Draw ticket', 'ticket', 1, 70000, null, 4),
 ('Streak freeze', 'freeze', 1, 50000, null, 5),
 ('2× XP for 24 hours', 'xp_boost', 24, 30000, 500, 6);

create table public.spins (
 id bigint generated always as identity primary key,
 user_id uuid not null references public.profiles on delete cascade,
 local_day date not null,
 prize_id uuid references public.spin_prizes on delete set null,
 label text not null,
 kind text not null,
 value integer not null,
 rng text not null,
 created_at timestamptz not null default now(),
 unique (user_id, local_day)
);
create index spins_prize_day on public.spins (prize_id, created_at);

alter table public.spin_prizes enable row level security;
alter table public.spins enable row level security;
revoke all on public.spin_prizes, public.spins from public, anon, authenticated, service_role;
grant select on public.spin_prizes to anon, authenticated, service_role;
grant select on public.spins to authenticated, service_role;
-- Odds are public (CLAUDE.md §2.9).
create policy prizes_public on public.spin_prizes for select to anon, authenticated using (active);
create policy spins_own on public.spins for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- Draws
-- ---------------------------------------------------------------------------------------------
create table public.draws (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(trim(title)) between 3 and 120),
 prize text not null check (length(trim(prize)) between 3 and 300),
 starts_at timestamptz not null,
 ends_at timestamptz not null check (ends_at > starts_at),
 max_tickets_per_user integer not null default 10 check (max_tickets_per_user between 1 and 100),
 status text not null default 'scheduled' check (status in ('scheduled', 'drawn', 'cancelled')),
 winner_user uuid references public.profiles on delete set null,
 winner_label text,
 tickets_total integer,
 rng text,
 drawn_at timestamptz,
 drawn_by uuid references public.profiles on delete set null,
 created_at timestamptz not null default now()
);
create table public.draw_entries (
 draw_id uuid not null references public.draws on delete cascade,
 user_id uuid not null references public.profiles on delete cascade,
 tickets integer not null check (tickets > 0),
 free_entry boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key (draw_id, user_id)
);
create index draw_entries_user on public.draw_entries (user_id);

alter table public.draws enable row level security;
alter table public.draw_entries enable row level security;
revoke all on public.draws, public.draw_entries from public, anon, authenticated, service_role;
grant select on public.draws, public.draw_entries to service_role;
-- Public list: title, prize, dates and the published winner label; never the winner's id.
grant select (id, title, prize, starts_at, ends_at, max_tickets_per_user, status, winner_label, tickets_total, drawn_at)
 on public.draws to anon, authenticated;
grant select on public.draw_entries to authenticated;
create policy draws_public on public.draws for select to anon, authenticated using (status <> 'cancelled');
create policy entries_own on public.draw_entries for select to authenticated using (user_id = (select auth.uid()));

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
 'claim_status', 'redemption_status', 'coins_released', 'coins_adjusted', 'coins_expiring', 'coins_expired',
 'support_reply', 'appeal_decided', 'data_request', 'draw_won'));

create function private.current_draw(p_now timestamptz) returns uuid
language sql stable set search_path = '' as $$
 select id from public.draws where status = 'scheduled' and starts_at <= p_now and ends_at > p_now order by ends_at limit 1;
$$;

create function private.add_tickets(p_user uuid, p_draw uuid, p_tickets integer, p_free boolean) returns integer
language plpgsql set search_path = '' as $$
declare cap integer; total integer;
begin
 select max_tickets_per_user into strict cap from public.draws where id = p_draw;
 insert into public.draw_entries as e (draw_id, user_id, tickets, free_entry)
 values (p_draw, p_user, least(p_tickets, cap), p_free)
 on conflict (draw_id, user_id) do update set tickets = least(e.tickets + p_tickets, cap),
  free_entry = e.free_entry or p_free, updated_at = now()
 returning tickets into total;
 return total;
end;
$$;

create function public.spin(p_user uuid, p_ip_country text)
returns table (label text, kind text, value integer, odds_ppm integer)
language plpgsql security definer set search_path = '' as $$
declare d date; roll record; pick public.spin_prizes%rowtype; acc bigint := 0; total bigint; fallback public.spin_prizes%rowtype;
 awarded_kind text; awarded_value integer; draw uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
 if not private.chance_allowed('spins', p_user, p_ip_country) then
   raise exception 'spins are not available' using errcode = '42501';
 end if;
 perform private.assert_unrestricted(p_user);
 select private.local_day(now(), timezone) into strict d from public.profiles where id = p_user and onboarded_at is not null;
 if exists (select from public.spins s where s.user_id = p_user and s.local_day = d) then
   raise exception 'already spun today' using errcode = '23505';
 end if;
 select coalesce(sum(p.odds_ppm), 0) into total from public.spin_prizes p where p.active;
 if total <> 1000000 then raise exception 'spin odds must add up to 100%%' using errcode = '23514'; end if;
 select * into roll from private.secure_random(1000000);
 for pick in select * from public.spin_prizes p where p.active and p.odds_ppm > 0 order by p.sort, p.id loop
   acc := acc + pick.odds_ppm;
   exit when roll.value < acc;
 end loop;
 -- A prize over its daily cap falls back to the most likely prize (published with the odds).
 if pick.daily_cap is not null and (select count(*) from public.spins s where s.prize_id = pick.id
   and s.created_at >= date_trunc('day', now(), 'UTC')) >= pick.daily_cap then
   select * into fallback from public.spin_prizes p where p.active order by p.odds_ppm desc, p.sort limit 1;
   pick := fallback;
 end if;
 awarded_kind := pick.kind;
 awarded_value := pick.value;
 if pick.kind = 'xp' then
   perform private.award_engagement(p_user, 'spin', 'spin:' || p_user || ':' || d, pick.value, now());
 elsif pick.kind = 'xp_boost' then
   insert into public.user_boosters (user_id, kind, value, expires_at) values (p_user, 'xp', 2, now() + make_interval(hours => pick.value))
   on conflict (user_id, kind) do update set value = 2, expires_at = greatest(public.user_boosters.expires_at, excluded.expires_at);
 elsif pick.kind = 'freeze' then
   update public.streaks set saved_freezes = saved_freezes + 1 where user_id = p_user;
   if not found then
     -- No streak yet to protect: give the smallest XP prize instead.
     awarded_kind := 'xp';
     awarded_value := 10;
     perform private.award_engagement(p_user, 'spin', 'spin:' || p_user || ':' || d, 10, now());
   end if;
 elsif pick.kind = 'ticket' then
   draw := private.current_draw(now());
   if draw is not null and private.chance_allowed('draws', p_user, p_ip_country) then
     perform private.add_tickets(p_user, draw, pick.value, false);
   else
     awarded_kind := 'xp';
     awarded_value := 10;
     perform private.award_engagement(p_user, 'spin', 'spin:' || p_user || ':' || d, 10, now());
   end if;
 end if;
 insert into public.spins (user_id, local_day, prize_id, label, kind, value, rng)
 values (p_user, d, pick.id, case when awarded_kind = pick.kind then pick.label else '10 XP' end, awarded_kind, awarded_value, roll.raw);
 return query select case when awarded_kind = pick.kind then pick.label else '10 XP'::text end, awarded_kind, awarded_value, pick.odds_ppm;
end;
$$;

-- Free entry: one ticket per draw, no purchase involved.
create function public.enter_draw(p_user uuid, p_draw uuid, p_ip_country text) returns integer
language plpgsql security definer set search_path = '' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
 if not private.chance_allowed('draws', p_user, p_ip_country) then
   raise exception 'draws are not available' using errcode = '42501';
 end if;
 perform private.assert_unrestricted(p_user);
 if not exists (select from public.profiles where id = p_user and onboarded_at is not null) then
   raise exception 'onboarded member required' using errcode = '42501';
 end if;
 if p_draw is distinct from private.current_draw(now()) then raise exception 'draw is not open' using errcode = '23514'; end if;
 if exists (select from public.draw_entries where draw_id = p_draw and user_id = p_user and free_entry) then
   return (select tickets from public.draw_entries where draw_id = p_draw and user_id = p_user);
 end if;
 return private.add_tickets(p_user, p_draw, 1, true);
end;
$$;

create function public.run_draw(p_actor uuid, p_draw uuid, p_request_id text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare d public.draws%rowtype; total bigint; roll record; acc bigint := 0; e record; winner uuid; label text;
begin
 if not exists (select from public.admin_roles where user_id = p_actor and role = 'owner') then
   raise exception 'owner only' using errcode = '42501';
 end if;
 select * into d from public.draws where id = p_draw for update;
 if not found or d.status <> 'scheduled' then raise exception 'draw is not open' using errcode = '40001'; end if;
 if d.ends_at > now() then raise exception 'draw has not ended' using errcode = '23514'; end if;
 select coalesce(sum(tickets), 0) into total from public.draw_entries where draw_id = p_draw;
 if total = 0 then
   update public.draws set status = 'drawn', tickets_total = 0, drawn_at = now(), drawn_by = p_actor, winner_label = null where id = p_draw;
   return null;
 end if;
 select * into roll from private.secure_random(total);
 for e in select user_id, tickets from public.draw_entries where draw_id = p_draw order by user_id loop
   acc := acc + e.tickets;
   if roll.value < acc then winner := e.user_id; exit; end if;
 end loop;
 select coalesce(display_name, 'Member ' || upper(left(referral_code, 4))) into label from public.profiles where id = winner;
 update public.draws set status = 'drawn', winner_user = winner, winner_label = label, tickets_total = total, rng = roll.raw,
  drawn_at = now(), drawn_by = p_actor where id = p_draw;
 perform private.deliver_in_app(winner, 'draw_won', p_draw::text, d.title);
 perform private.write_audit(p_actor, 'draw.run', 'draw', p_draw::text, null,
  jsonb_build_object('winner', winner, 'tickets', total, 'rng', roll.raw), 'Weekly draw', p_request_id);
 return winner;
end;
$$;

create function public.admin_save_draw(p_actor uuid, p_id uuid, p_title text, p_prize text, p_starts timestamptz,
 p_ends timestamptz, p_max integer, p_cancel boolean, p_request_id text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare draw uuid;
begin
 if not exists (select from public.admin_roles where user_id = p_actor and role = 'owner') then
   raise exception 'owner only' using errcode = '42501';
 end if;
 if p_id is null then
   insert into public.draws (title, prize, starts_at, ends_at, max_tickets_per_user)
   values (trim(p_title), trim(p_prize), p_starts, p_ends, p_max) returning id into draw;
 else
   update public.draws set title = trim(p_title), prize = trim(p_prize), starts_at = p_starts, ends_at = p_ends,
    max_tickets_per_user = p_max, status = case when coalesce(p_cancel, false) then 'cancelled' else status end
   where id = p_id and status = 'scheduled' returning id into draw;
   if draw is null then raise exception 'only scheduled draws can be edited' using errcode = '23514'; end if;
 end if;
 perform private.write_audit(p_actor, 'draw.save', 'draw', draw::text, null,
  jsonb_build_object('title', p_title, 'ends_at', p_ends, 'cancel', p_cancel), 'Draw setup', p_request_id);
 return draw;
end;
$$;

-- Replaces the whole prize table in one step so the odds always add up to 100%.
create function public.admin_save_spin_prizes(p_actor uuid, p_prizes jsonb, p_reason text, p_request_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare total bigint; before jsonb;
begin
 if not exists (select from public.admin_roles where user_id = p_actor and role = 'owner')
  or length(trim(coalesce(p_reason, ''))) not between 3 and 1000 then
   raise exception 'owner and reason required' using errcode = '42501';
 end if;
 if jsonb_typeof(p_prizes) <> 'array' or jsonb_array_length(p_prizes) not between 1 and 12 then
   raise exception 'invalid prizes' using errcode = '22023';
 end if;
 select coalesce(sum((x ->> 'odds_ppm')::bigint), 0) into total from jsonb_array_elements(p_prizes) x;
 if total <> 1000000 then raise exception 'odds must add up to 100%%' using errcode = '23514'; end if;
 select jsonb_agg(to_jsonb(p) order by p.sort) into before from public.spin_prizes p where p.active;
 update public.spin_prizes set active = false;
 insert into public.spin_prizes (label, kind, value, odds_ppm, daily_cap, sort)
 select x ->> 'label', x ->> 'kind', (x ->> 'value')::integer, (x ->> 'odds_ppm')::integer,
  nullif(x ->> 'daily_cap', '')::integer, (row_number() over ())::smallint
 from jsonb_array_elements(p_prizes) x;
 perform private.write_audit(p_actor, 'spin.prizes', 'spin_prizes', 'all', before, p_prizes, p_reason, p_request_id);
end;
$$;

revoke execute on function private.secure_random(bigint), private.chance_allowed(text, uuid, text), private.current_draw(timestamptz),
 private.add_tickets(uuid, uuid, integer, boolean),
 public.spin(uuid, text), public.enter_draw(uuid, uuid, text), public.run_draw(uuid, uuid, text),
 public.admin_save_draw(uuid, uuid, text, text, timestamptz, timestamptz, integer, boolean, text),
 public.admin_save_spin_prizes(uuid, jsonb, text, text)
 from public, anon, authenticated;
grant execute on function public.spin(uuid, text), public.enter_draw(uuid, uuid, text), public.run_draw(uuid, uuid, text),
 public.admin_save_draw(uuid, uuid, text, text, timestamptz, timestamptz, integer, boolean, text),
 public.admin_save_spin_prizes(uuid, jsonb, text, text)
 to service_role;
