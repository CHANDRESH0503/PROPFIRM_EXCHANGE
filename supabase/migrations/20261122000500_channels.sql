-- Notification channels: Telegram bot links and web push subscriptions (08-notifications.md,
-- 16-trader-tools.md "Telegram bot"). In-app notifications stay the source of truth; a server job
-- copies each new one to the member's linked channels, following the same per-type preferences.

create table public.telegram_links (
 user_id uuid primary key references public.profiles on delete cascade,
 chat_id bigint not null unique,
 username text check (length(username) <= 64),
 linked_at timestamptz not null default now()
);

-- One-time codes from Settings, stored as SHA-256 hashes; valid for 15 minutes.
create table private.telegram_link_codes (
 code_hash text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
 user_id uuid not null references public.profiles on delete cascade,
 expires_at timestamptz not null
);
create index telegram_link_codes_user on private.telegram_link_codes (user_id);

create table public.push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles on delete cascade,
 endpoint text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
 p256dh text not null check (length(p256dh) between 20 and 200),
 auth text not null check (length(auth) between 8 and 100),
 failures integer not null default 0,
 created_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.notifications add column dispatched_at timestamptz;
-- Everything already in inboxes counts as delivered, so linking a channel never replays history.
update public.notifications set dispatched_at = created_at;
create index notifications_dispatch on public.notifications (id) where dispatched_at is null;

alter table public.telegram_links enable row level security;
alter table private.telegram_link_codes enable row level security;
alter table public.push_subscriptions enable row level security;
revoke all on public.telegram_links, public.push_subscriptions from public, anon, authenticated, service_role;
revoke all on private.telegram_link_codes from public, anon, authenticated, service_role;
grant select on public.telegram_links, public.push_subscriptions to authenticated, service_role;
create policy telegram_links_own on public.telegram_links for select to authenticated using (user_id = (select auth.uid()));
create policy push_subscriptions_own on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));

create function public.telegram_issue_code(p_user uuid, p_hash text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not exists (select from public.profiles where id = p_user and onboarded_at is not null) then
   raise exception 'onboarded member required' using errcode = '42501';
 end if;
 delete from private.telegram_link_codes where user_id = p_user or expires_at < now();
 insert into private.telegram_link_codes (code_hash, user_id, expires_at) values (p_hash, p_user, now() + interval '15 minutes');
end;
$$;

-- Consumes a code and links the chat. A chat belongs to one member; relinking moves it.
create function public.telegram_link(p_hash text, p_chat bigint, p_username text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare member uuid;
begin
 delete from private.telegram_link_codes where code_hash = p_hash and expires_at > now() returning user_id into member;
 if member is null then raise exception 'code invalid or expired' using errcode = 'P0002'; end if;
 delete from public.telegram_links where chat_id = p_chat or user_id = member;
 insert into public.telegram_links (user_id, chat_id, username) values (member, p_chat, nullif(left(p_username, 64), ''));
 return member;
end;
$$;

create function public.telegram_unlink(p_user uuid) returns void
language sql security definer set search_path = '' as $$
 delete from public.telegram_links where user_id = p_user;
$$;

create function public.telegram_unlink_chat(p_chat bigint) returns void
language sql security definer set search_path = '' as $$
 delete from public.telegram_links where chat_id = p_chat;
$$;

create function public.push_subscribe(p_user uuid, p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
 insert into public.push_subscriptions as s (user_id, endpoint, p256dh, auth)
 values (p_user, p_endpoint, p_p256dh, p_auth)
 on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, failures = 0;
 -- Keep the ten most recent devices.
 delete from public.push_subscriptions where id in (
   select id from public.push_subscriptions where user_id = p_user order by created_at desc offset 10);
end;
$$;

create function public.push_unsubscribe(p_user uuid, p_endpoint text) returns void
language sql security definer set search_path = '' as $$
 delete from public.push_subscriptions where user_id = p_user and endpoint = p_endpoint;
$$;

-- Records a delivery failure. Gone endpoints and five failures in a row remove the subscription.
create function public.push_failed(p_endpoint text, p_gone boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if p_gone then
   delete from public.push_subscriptions where endpoint = p_endpoint;
 else
   update public.push_subscriptions set failures = failures + 1 where endpoint = p_endpoint;
   delete from public.push_subscriptions where endpoint = p_endpoint and failures >= 5;
 end if;
end;
$$;

create function public.push_succeeded(p_endpoint text) returns void
language sql security definer set search_path = '' as $$
 update public.push_subscriptions set failures = 0 where endpoint = p_endpoint and failures > 0;
$$;

-- Claims a batch of new notifications for channel delivery. Each is claimed once (at-most-once
-- delivery: a crash after claiming skips the copy, never sends it twice). Older than a day is
-- marked without sending.
create function public.claim_notification_batch(p_limit integer) returns table (id bigint, user_id uuid, kind text, detail text)
language plpgsql security definer set search_path = '' as $$
begin
 update public.notifications n set dispatched_at = now()
 where n.dispatched_at is null and n.created_at < now() - interval '1 day';
 return query
 update public.notifications n set dispatched_at = now()
 where n.id in (
   select x.id from public.notifications x where x.dispatched_at is null order by x.id limit least(greatest(p_limit, 1), 500)
   for update skip locked)
 returning n.id, n.user_id, n.kind, n.detail;
end;
$$;

revoke execute on function public.telegram_issue_code(uuid, text), public.telegram_link(text, bigint, text),
 public.telegram_unlink(uuid), public.telegram_unlink_chat(bigint), public.push_subscribe(uuid, text, text, text),
 public.push_unsubscribe(uuid, text), public.push_failed(text, boolean), public.push_succeeded(text),
 public.claim_notification_batch(integer) from public, anon, authenticated;
grant execute on function public.telegram_issue_code(uuid, text), public.telegram_link(text, bigint, text),
 public.telegram_unlink(uuid), public.telegram_unlink_chat(bigint), public.push_subscribe(uuid, text, text, text),
 public.push_unsubscribe(uuid, text), public.push_failed(text, boolean), public.push_succeeded(text),
 public.claim_notification_batch(integer) to service_role;
