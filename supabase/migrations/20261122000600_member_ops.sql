-- Member operations (09-admin.md §9, 05-economy.md): restrictions, funded campaign grants,
-- staff adjustments, staff notes and inactivity expiry with warnings.
-- CLAUDE.md §2.1: Coins not tied to a commission come only from a capped campaign budget.
-- CLAUDE.md §2.3: every change is a new ledger row; nothing is edited.

-- ---------------------------------------------------------------------------------------------
-- Restrictions: frozen (can use the site, cannot claim or redeem), suspended (cannot sign in),
-- banned (permanent). Pending Coins are kept, never deleted.
-- ---------------------------------------------------------------------------------------------
create table public.member_restrictions (
 user_id uuid primary key references public.profiles on delete cascade,
 level text not null check (level in ('frozen', 'suspended', 'banned')),
 reason text not null check (length(trim(reason)) between 3 and 1000),
 member_message text check (length(member_message) <= 500),
 set_by uuid references public.profiles on delete set null,
 set_at timestamptz not null default now()
);
alter table public.member_restrictions enable row level security;
revoke all on public.member_restrictions from public, anon, authenticated, service_role;
grant select on public.member_restrictions to authenticated, service_role;
-- Members see their own status and message, never the internal reason (column grant below).
create policy restrictions_own on public.member_restrictions for select to authenticated using (user_id = (select auth.uid()));
revoke select on public.member_restrictions from authenticated;
grant select (user_id, level, member_message, set_at) on public.member_restrictions to authenticated;

create function private.assert_unrestricted(p_user uuid) returns void
language plpgsql stable set search_path = '' as $$
begin
 if p_user is not null and exists (select from public.member_restrictions where user_id = p_user) then
   raise exception 'member rewards are frozen' using errcode = '42501';
 end if;
end;
$$;

create function private.claims_restriction_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 perform private.assert_unrestricted(new.user_id);
 return new;
end;
$$;
create trigger claims_restricted before insert on public.purchase_claims for each row execute function private.claims_restriction_guard();

create function private.redemptions_restriction_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 perform private.assert_unrestricted((select user_id from public.wallet_accounts where id = new.wallet_id));
 return new;
end;
$$;
create trigger redemptions_restricted before insert on public.redemptions for each row execute function private.redemptions_restriction_guard();

create function public.admin_set_restriction(p_actor uuid, p_user uuid, p_level text, p_reason text, p_message text, p_request_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare before jsonb;
begin
 if not exists (select from public.admin_roles where user_id = p_actor and role in ('owner', 'support'))
  or (p_level = 'banned' and not exists (select from public.admin_roles where user_id = p_actor and role = 'owner'))
  or length(trim(coalesce(p_reason, ''))) not between 3 and 1000 then
   raise exception 'permission and reason required' using errcode = '42501';
 end if;
 if p_actor = p_user then raise exception 'staff cannot restrict themselves' using errcode = '42501'; end if;
 select to_jsonb(r) into before from public.member_restrictions r where user_id = p_user;
 if p_level is null then
   delete from public.member_restrictions where user_id = p_user;
 elsif p_level in ('frozen', 'suspended', 'banned') then
   insert into public.member_restrictions as r (user_id, level, reason, member_message, set_by)
   values (p_user, p_level, trim(p_reason), nullif(trim(p_message), ''), p_actor)
   on conflict (user_id) do update set level = excluded.level, reason = excluded.reason,
    member_message = excluded.member_message, set_by = excluded.set_by, set_at = now();
 else
   raise exception 'invalid level' using errcode = '22023';
 end if;
 perform private.write_audit(p_actor, 'member.restriction', 'profile', p_user::text, before,
  jsonb_build_object('level', p_level, 'message', p_message), p_reason, p_request_id);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Campaign budgets: the only source of Coins that are not a share of a confirmed commission.
-- ---------------------------------------------------------------------------------------------
create table public.campaign_budgets (
 id uuid primary key default gen_random_uuid(),
 name text not null unique check (length(trim(name)) between 3 and 120),
 purpose text not null check (length(trim(purpose)) between 3 and 500),
 cap_coins integer not null check (cap_coins > 0),
 starts_at timestamptz not null default now(),
 ends_at timestamptz,
 active boolean not null default true,
 created_by uuid references public.profiles on delete set null,
 created_at timestamptz not null default now(),
 check (ends_at is null or ends_at > starts_at)
);
alter table public.campaign_budgets enable row level security;
revoke all on public.campaign_budgets from public, anon, authenticated, service_role;
grant select on public.campaign_budgets to service_role;

create view public.campaign_budget_usage with (security_invoker = true) as
select b.id, b.name, b.purpose, b.cap_coins, b.starts_at, b.ends_at, b.active,
 coalesce(sum(e.amount) filter (where e.amount > 0), 0)::bigint as granted,
 b.cap_coins - coalesce(sum(e.amount) filter (where e.amount > 0), 0)::bigint as remaining
from public.campaign_budgets b
left join public.ledger_entries e on e.ref_type = 'campaign' and e.ref_id = b.id
group by b.id;
revoke all on public.campaign_budget_usage from public, anon, authenticated;
grant select on public.campaign_budget_usage to service_role;

create function public.admin_save_budget(p_actor uuid, p_id uuid, p_name text, p_purpose text, p_cap integer,
 p_starts timestamptz, p_ends timestamptz, p_active boolean, p_reason text, p_request_id text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare budget uuid; before jsonb; used bigint;
begin
 if not exists (select from public.admin_roles where user_id = p_actor and role in ('owner', 'finance'))
  or length(trim(coalesce(p_reason, ''))) not between 3 and 1000 then
   raise exception 'finance permission and reason required' using errcode = '42501';
 end if;
 if p_id is null then
   insert into public.campaign_budgets (name, purpose, cap_coins, starts_at, ends_at, active, created_by)
   values (trim(p_name), trim(p_purpose), p_cap, coalesce(p_starts, now()), p_ends, coalesce(p_active, true), p_actor)
   returning id into budget;
 else
   select to_jsonb(b) into before from public.campaign_budgets b where id = p_id for update;
   if before is null then raise exception 'budget not found' using errcode = 'P0002'; end if;
   select coalesce(sum(amount) filter (where amount > 0), 0) into used from public.ledger_entries where ref_type = 'campaign' and ref_id = p_id;
   if p_cap < used then raise exception 'cap below Coins already granted' using errcode = '23514'; end if;
   update public.campaign_budgets set name = trim(p_name), purpose = trim(p_purpose), cap_coins = p_cap,
    starts_at = coalesce(p_starts, starts_at), ends_at = p_ends, active = coalesce(p_active, active)
   where id = p_id returning id into budget;
 end if;
 perform private.write_audit(p_actor, 'campaign.save', 'campaign_budget', budget::text, before,
  jsonb_build_object('name', p_name, 'cap', p_cap, 'active', p_active, 'ends_at', p_ends), p_reason, p_request_id);
 return budget;
end;
$$;

-- Large adjustments need an explicit confirmation (09-admin.md §9).
insert into public.site_settings (key, value, description) values
 ('economy.adjust_confirm_coins', '5000'::jsonb, 'Coin grants or removals at or above this amount need an explicit confirmation.')
on conflict (key) do nothing;

create function public.admin_grant_coins(p_actor uuid, p_user uuid, p_budget uuid, p_amount integer, p_reason text,
 p_member_note text, p_confirmed boolean, p_request_id text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare b public.campaign_budgets%rowtype; used bigint; threshold integer; cfg integer; entry bigint;
begin
 if not exists (select from public.admin_roles where user_id = p_actor and role in ('owner', 'finance'))
  or length(trim(coalesce(p_reason, ''))) not between 3 and 1000 or p_request_id is null then
   raise exception 'finance permission and reason required' using errcode = '42501';
 end if;
 if p_amount is null or p_amount <= 0 or p_amount > 1000000 then raise exception 'invalid amount' using errcode = '22023'; end if;
 if p_actor = p_user then raise exception 'staff cannot grant to themselves' using errcode = '42501'; end if;
 -- A retried request returns the original entry before any cap or budget check.
 select id into entry from public.ledger_entries where idempotency_key = 'grant:' || p_request_id;
 if found then return entry; end if;
 select (value #>> '{}')::integer into threshold from public.site_settings where key = 'economy.adjust_confirm_coins';
 if p_amount >= coalesce(threshold, 5000) and not coalesce(p_confirmed, false) then
   raise exception 'large grant needs confirmation' using errcode = '23514';
 end if;
 select * into b from public.campaign_budgets where id = p_budget for update;
 if not found or not b.active or b.starts_at > now() or (b.ends_at is not null and b.ends_at <= now()) then
   raise exception 'campaign budget not open' using errcode = '23514';
 end if;
 select coalesce(sum(amount) filter (where amount > 0), 0) into used from public.ledger_entries where ref_type = 'campaign' and ref_id = b.id;
 if used + p_amount > b.cap_coins then raise exception 'campaign budget cap reached' using errcode = '23514'; end if;
 perform private.assert_unrestricted(p_user);
 select version into strict cfg from public.economy_config where effective_at <= now() order by effective_at desc limit 1;
 insert into public.ledger_entries (wallet_id, amount, bucket, type, ref_type, ref_id, idempotency_key, config_version, created_by)
 values (private.wallet_for(p_user), p_amount, 'available', 'campaign_grant', 'campaign', b.id, 'grant:' || p_request_id, cfg, p_actor)
 on conflict (idempotency_key) do nothing returning id into entry;
 if entry is null then
   select id into entry from public.ledger_entries where idempotency_key = 'grant:' || p_request_id;
   return entry;
 end if;
 perform private.deliver_in_app(p_user, 'coins_adjusted', entry::text, p_amount::text || '|' || coalesce(left(trim(p_member_note), 300), ''));
 perform private.write_audit(p_actor, 'coins.grant', 'profile', p_user::text, null,
  jsonb_build_object('amount', p_amount, 'budget', b.id, 'entry', entry), p_reason, p_request_id);
 return entry;
end;
$$;

-- Removes available Coins (fraud or error correction). Never takes the balance below zero.
create function public.admin_remove_coins(p_actor uuid, p_user uuid, p_amount integer, p_reason text, p_member_note text,
 p_confirmed boolean, p_request_id text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare wallet uuid; available bigint; threshold integer; cfg integer; entry bigint;
begin
 if not exists (select from public.admin_roles where user_id = p_actor and role in ('owner', 'finance'))
  or length(trim(coalesce(p_reason, ''))) not between 3 and 1000 or p_request_id is null then
   raise exception 'finance permission and reason required' using errcode = '42501';
 end if;
 if p_amount is null or p_amount <= 0 then raise exception 'invalid amount' using errcode = '22023'; end if;
 select (value #>> '{}')::integer into threshold from public.site_settings where key = 'economy.adjust_confirm_coins';
 if p_amount >= coalesce(threshold, 5000) and not coalesce(p_confirmed, false) then
   raise exception 'large removal needs confirmation' using errcode = '23514';
 end if;
 select id into entry from public.ledger_entries where idempotency_key = 'remove:' || p_request_id;
 if found then return entry; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
 wallet := private.wallet_for(p_user);
 select coalesce(sum(amount), 0) into available from public.ledger_entries where wallet_id = wallet and bucket = 'available';
 if p_amount > available then raise exception 'more than the available balance' using errcode = '23514'; end if;
 select version into strict cfg from public.economy_config where effective_at <= now() order by effective_at desc limit 1;
 insert into public.ledger_entries (wallet_id, amount, bucket, type, ref_type, ref_id, idempotency_key, config_version, created_by)
 values (wallet, -p_amount, 'available', 'adjustment', 'admin_adjustment', gen_random_uuid(), 'remove:' || p_request_id, cfg, p_actor)
 on conflict (idempotency_key) do nothing returning id into entry;
 if entry is null then
   select id into entry from public.ledger_entries where idempotency_key = 'remove:' || p_request_id;
   return entry;
 end if;
 perform private.deliver_in_app(p_user, 'coins_adjusted', entry::text, (-p_amount)::text || '|' || coalesce(left(trim(p_member_note), 300), ''));
 perform private.write_audit(p_actor, 'coins.remove', 'profile', p_user::text, jsonb_build_object('available', available),
  jsonb_build_object('amount', -p_amount, 'entry', entry), p_reason, p_request_id);
 return entry;
end;
$$;

create function public.admin_adjust_xp(p_actor uuid, p_user uuid, p_amount integer, p_reason text, p_request_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if not exists (select from public.admin_roles where user_id = p_actor and role in ('owner', 'support', 'finance'))
  or length(trim(coalesce(p_reason, ''))) not between 3 and 1000 or p_request_id is null then
   raise exception 'permission and reason required' using errcode = '42501';
 end if;
 if p_amount is null or p_amount = 0 or abs(p_amount) > 100000 then raise exception 'invalid amount' using errcode = '22023'; end if;
 insert into public.xp_events (user_id, amount, source, idempotency_key) values (p_user, p_amount, 'admin', 'xp:' || p_request_id)
 on conflict (idempotency_key) do nothing;
 if found then
   perform private.write_audit(p_actor, 'xp.adjust', 'profile', p_user::text, null, jsonb_build_object('amount', p_amount), p_reason, p_request_id);
 end if;
end;
$$;

create function public.admin_grant_booster(p_actor uuid, p_user uuid, p_kind text, p_value integer, p_hours integer, p_reason text, p_request_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if not exists (select from public.admin_roles where user_id = p_actor and role in ('owner', 'support'))
  or length(trim(coalesce(p_reason, ''))) not between 3 and 1000 then
   raise exception 'permission and reason required' using errcode = '42501';
 end if;
 if p_kind = 'giveback' and p_value in (300, 500) then
   insert into public.user_boosters as b (user_id, kind, value) values (p_user, 'giveback', p_value)
   on conflict (user_id, kind) do update set value = greatest(b.value, excluded.value);
 elsif p_kind = 'xp' and p_value = 2 and p_hours between 1 and 168 then
   insert into public.user_boosters (user_id, kind, value, expires_at) values (p_user, 'xp', 2, now() + make_interval(hours => p_hours))
   on conflict (user_id, kind) do update set value = 2, expires_at = excluded.expires_at;
 elsif p_kind = 'freeze' and p_value between 1 and 3 then
   update public.streaks set saved_freezes = saved_freezes + p_value where user_id = p_user;
   if not found then raise exception 'member has no streak yet' using errcode = '23514'; end if;
 else
   raise exception 'invalid booster' using errcode = '22023';
 end if;
 perform private.write_audit(p_actor, 'booster.grant', 'profile', p_user::text, null,
  jsonb_build_object('kind', p_kind, 'value', p_value, 'hours', p_hours), p_reason, p_request_id);
end;
$$;

-- Staff notes: staff only, never shown to the member.
create table public.member_notes (
 id bigint generated always as identity primary key,
 user_id uuid not null references public.profiles on delete cascade,
 author uuid references public.profiles on delete set null,
 body text not null check (length(trim(body)) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index member_notes_user on public.member_notes (user_id, id desc);
alter table public.member_notes enable row level security;
revoke all on public.member_notes from public, anon, authenticated, service_role;
grant select on public.member_notes to service_role;

create function public.admin_add_note(p_actor uuid, p_user uuid, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not exists (select from public.admin_roles where user_id = p_actor) then
   raise exception 'staff only' using errcode = '42501';
 end if;
 insert into public.member_notes (user_id, author, body) values (p_user, p_actor, trim(p_body));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Notification kinds for these flows. New kinds are transactional and always delivered.
-- ---------------------------------------------------------------------------------------------
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
 'claim_status', 'redemption_status', 'coins_released', 'coins_adjusted', 'coins_expiring', 'coins_expired',
 'support_reply', 'appeal_decided', 'data_request'));

-- ---------------------------------------------------------------------------------------------
-- Inactivity expiry: 12 months with no sign-in, earn or redemption. Warnings at 30 and 7 days.
-- ---------------------------------------------------------------------------------------------
create function private.last_activity(p_user uuid) returns timestamptz
language sql stable security definer set search_path = '' as $$
 select greatest(
  (select last_sign_in_at from auth.users where id = p_user),
  (select max(e.created_at) from public.ledger_entries e join public.wallet_accounts w on w.id = e.wallet_id
    where w.user_id = p_user and e.type <> 'expiry'),
  (select created_at from public.profiles where id = p_user));
$$;

create function public.process_coin_expiry(p_now timestamptz default now())
returns table (expired integer, warned integer) language plpgsql security definer set search_path = '' as $$
declare r record; due timestamptz; cfg integer; n_expired integer := 0; n_warned integer := 0;
begin
 select version into strict cfg from public.economy_config where effective_at <= p_now order by effective_at desc limit 1;
 for r in
   select w.id as wallet_id, w.user_id, sum(e.amount) as available
   from public.wallet_accounts w join public.ledger_entries e on e.wallet_id = w.id and e.bucket = 'available'
   where w.user_id is not null group by w.id having sum(e.amount) > 0
 loop
   due := private.last_activity(r.user_id) + interval '12 months';
   if due <= p_now then
     insert into public.ledger_entries (wallet_id, amount, bucket, type, ref_type, ref_id, idempotency_key, config_version)
     values (r.wallet_id, -r.available, 'available', 'expiry', 'expiry', r.wallet_id,
      'expiry:' || r.wallet_id || ':' || to_char(due, 'YYYY-MM-DD'), cfg)
     on conflict (idempotency_key) do nothing;
     if found then
       n_expired := n_expired + 1;
       perform private.deliver_in_app(r.user_id, 'coins_expired', to_char(due, 'YYYY-MM-DD'), r.available::text);
     end if;
   elsif due - p_now <= interval '7 days' then
     perform private.deliver_in_app(r.user_id, 'coins_expiring', 'w7:' || to_char(due, 'YYYY-MM-DD'), r.available::text || '|' || to_char(due, 'YYYY-MM-DD'));
     n_warned := n_warned + 1;
   elsif due - p_now <= interval '30 days' then
     perform private.deliver_in_app(r.user_id, 'coins_expiring', 'w30:' || to_char(due, 'YYYY-MM-DD'), r.available::text || '|' || to_char(due, 'YYYY-MM-DD'));
     n_warned := n_warned + 1;
   end if;
 end loop;
 return query select n_expired, n_warned;
end;
$$;

-- Staff user search: email, referral code, id or order reference.
create function public.admin_find_members(p_actor uuid, p_query text, p_limit integer default 25)
returns table (id uuid, email text, referral_code text, country_code text, created_at timestamptz, restriction text)
language plpgsql stable security definer set search_path = '' as $$
declare q text := lower(trim(coalesce(p_query, '')));
begin
 if not exists (select from public.admin_roles where user_id = p_actor) then
   raise exception 'staff only' using errcode = '42501';
 end if;
 return query
 select p.id, u.email::text, p.referral_code, p.country_code::text, p.created_at, r.level
 from public.profiles p
 join auth.users u on u.id = p.id
 left join public.member_restrictions r on r.user_id = p.id
 where q = '' or lower(u.email) like '%' || q || '%' or lower(p.referral_code) = q or p.id::text = q
  or exists (select from public.purchase_claims c where c.user_id = p.id and lower(c.order_ref) = q)
 order by p.created_at desc
 limit least(greatest(p_limit, 1), 100);
end;
$$;

revoke execute on function private.assert_unrestricted(uuid), private.claims_restriction_guard(), private.redemptions_restriction_guard(),
 private.last_activity(uuid),
 public.admin_set_restriction(uuid, uuid, text, text, text, text),
 public.admin_save_budget(uuid, uuid, text, text, integer, timestamptz, timestamptz, boolean, text, text),
 public.admin_grant_coins(uuid, uuid, uuid, integer, text, text, boolean, text),
 public.admin_remove_coins(uuid, uuid, integer, text, text, boolean, text),
 public.admin_adjust_xp(uuid, uuid, integer, text, text),
 public.admin_grant_booster(uuid, uuid, text, integer, integer, text, text),
 public.admin_add_note(uuid, uuid, text),
 public.process_coin_expiry(timestamptz),
 public.admin_find_members(uuid, text, integer)
 from public, anon, authenticated;
grant execute on function
 public.admin_set_restriction(uuid, uuid, text, text, text, text),
 public.admin_save_budget(uuid, uuid, text, text, integer, timestamptz, timestamptz, boolean, text, text),
 public.admin_grant_coins(uuid, uuid, uuid, integer, text, text, boolean, text),
 public.admin_remove_coins(uuid, uuid, integer, text, text, boolean, text),
 public.admin_adjust_xp(uuid, uuid, integer, text, text),
 public.admin_grant_booster(uuid, uuid, text, integer, integer, text, text),
 public.admin_add_note(uuid, uuid, text),
 public.process_coin_expiry(timestamptz),
 public.admin_find_members(uuid, text, integer)
 to service_role;
