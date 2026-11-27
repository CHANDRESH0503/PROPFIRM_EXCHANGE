-- Support and data rights (18-data-and-operations.md §9 and §12, 09-admin.md §23–25).

-- ---------------------------------------------------------------------------------------------
-- Help centre and changelog: staff-edited, public once published.
-- ---------------------------------------------------------------------------------------------
create table public.help_articles (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80),
 category text not null check (category in ('getting-started', 'claims', 'coins', 'rewards', 'journal', 'account')),
 title text not null check (length(trim(title)) between 3 and 140),
 summary text not null check (length(trim(summary)) between 3 and 300),
 body text not null check (length(trim(body)) between 3 and 20000),
 status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
 updated_at timestamptz not null default now(),
 updated_by uuid references public.profiles on delete set null
);
create index help_articles_published on public.help_articles (category, title) where status = 'published';

create table public.changelog_entries (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(trim(title)) between 3 and 140),
 body text not null check (length(trim(body)) between 3 and 4000),
 status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
 published_at timestamptz,
 updated_by uuid references public.profiles on delete set null,
 created_at timestamptz not null default now()
);
create index changelog_published on public.changelog_entries (published_at desc) where status = 'published';

alter table public.help_articles enable row level security;
alter table public.changelog_entries enable row level security;
revoke all on public.help_articles, public.changelog_entries from public, anon, authenticated, service_role;
grant select on public.help_articles, public.changelog_entries to anon, authenticated, service_role;
create policy help_public on public.help_articles for select to anon, authenticated using (status = 'published');
create policy changelog_public on public.changelog_entries for select to anon, authenticated using (status = 'published');

create function public.admin_save_article(p_actor uuid, p_id uuid, p_slug text, p_category text, p_title text,
 p_summary text, p_body text, p_status text, p_request_id text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare article uuid; before jsonb;
begin
 if not exists (select from public.admin_roles where user_id = p_actor and role in ('owner', 'support', 'content')) then
   raise exception 'support or content role required' using errcode = '42501';
 end if;
 if p_id is null then
   insert into public.help_articles (slug, category, title, summary, body, status, updated_by)
   values (p_slug, p_category, trim(p_title), trim(p_summary), trim(p_body), p_status, p_actor) returning id into article;
 else
   select to_jsonb(a) - 'body' into before from public.help_articles a where id = p_id;
   update public.help_articles set slug = p_slug, category = p_category, title = trim(p_title), summary = trim(p_summary),
    body = trim(p_body), status = p_status, updated_at = now(), updated_by = p_actor where id = p_id returning id into article;
   if article is null then raise exception 'article not found' using errcode = 'P0002'; end if;
 end if;
 perform private.write_audit(p_actor, 'help.save', 'help_article', article::text, before,
  jsonb_build_object('slug', p_slug, 'status', p_status, 'title', p_title), 'Help centre edit', p_request_id);
 return article;
end;
$$;

create function public.admin_save_changelog(p_actor uuid, p_id uuid, p_title text, p_body text, p_status text, p_request_id text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare entry uuid;
begin
 if not exists (select from public.admin_roles where user_id = p_actor and role in ('owner', 'content')) then
   raise exception 'content role required' using errcode = '42501';
 end if;
 if p_status not in ('draft', 'published', 'archived') then raise exception 'invalid status' using errcode = '22023'; end if;
 if p_id is null then
   insert into public.changelog_entries (title, body, status, published_at, updated_by)
   values (trim(p_title), trim(p_body), p_status, case when p_status = 'published' then now() end, p_actor) returning id into entry;
 else
   update public.changelog_entries set title = trim(p_title), body = trim(p_body), status = p_status, updated_by = p_actor,
    published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end
   where id = p_id returning id into entry;
   if entry is null then raise exception 'entry not found' using errcode = 'P0002'; end if;
 end if;
 perform private.write_audit(p_actor, 'changelog.save', 'changelog_entry', entry::text, null,
  jsonb_build_object('title', p_title, 'status', p_status), 'Changelog edit', p_request_id);
 return entry;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Support tickets
-- ---------------------------------------------------------------------------------------------
create table public.support_tickets (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references public.profiles on delete set null,
 topic text not null check (topic in ('claim', 'redemption', 'coins', 'account', 'journal', 'other')),
 subject text not null check (length(trim(subject)) between 3 and 140),
 status text not null default 'open' check (status in ('open', 'waiting_on_user', 'resolved')),
 priority text not null default 'normal' check (priority in ('normal', 'high')),
 claim_id uuid references public.purchase_claims on delete set null,
 redemption_id uuid references public.redemptions on delete set null,
 assigned_to uuid references public.profiles on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 -- Response target: first staff reply due 24 hours after the member's latest unanswered message.
 respond_by timestamptz
);
create index support_tickets_user on public.support_tickets (user_id, updated_at desc);
create index support_tickets_queue on public.support_tickets (status, respond_by);

create table public.support_messages (
 id bigint generated always as identity primary key,
 ticket_id uuid not null references public.support_tickets on delete cascade,
 author_id uuid references public.profiles on delete set null,
 from_staff boolean not null,
 internal boolean not null default false,
 body text not null check (length(trim(body)) between 1 and 5000),
 created_at timestamptz not null default now(),
 check (not internal or from_staff)
);
create index support_messages_ticket on public.support_messages (ticket_id, id);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.support_tickets, public.support_messages from public, anon, authenticated, service_role;
grant select on public.support_tickets, public.support_messages to authenticated, service_role;
create policy tickets_own on public.support_tickets for select to authenticated using (user_id = (select auth.uid()));
-- Members never see internal staff notes.
create policy messages_own on public.support_messages for select to authenticated using (
 not internal and exists (select from public.support_tickets t where t.id = ticket_id and t.user_id = (select auth.uid())));

create function public.support_open(p_user uuid, p_topic text, p_subject text, p_body text, p_claim uuid, p_redemption uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare ticket uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
 if not exists (select from public.profiles where id = p_user and onboarded_at is not null) then
   raise exception 'onboarded member required' using errcode = '42501';
 end if;
 if (select count(*) from public.support_tickets where user_id = p_user and status <> 'resolved') >= 5 then
   raise exception 'too many open tickets' using errcode = '23514';
 end if;
 if p_claim is not null and not exists (select from public.purchase_claims where id = p_claim and user_id = p_user) then
   raise exception 'claim not found' using errcode = 'P0002';
 end if;
 if p_redemption is not null and not exists (
   select from public.redemptions r join public.wallet_accounts w on w.id = r.wallet_id where r.id = p_redemption and w.user_id = p_user) then
   raise exception 'redemption not found' using errcode = 'P0002';
 end if;
 insert into public.support_tickets (user_id, topic, subject, claim_id, redemption_id, respond_by,
  priority)
 values (p_user, p_topic, trim(p_subject), p_claim, p_redemption, now() + interval '24 hours',
  case when p_topic in ('claim', 'redemption', 'coins') then 'high' else 'normal' end)
 returning id into ticket;
 insert into public.support_messages (ticket_id, author_id, from_staff, body) values (ticket, p_user, false, trim(p_body));
 return ticket;
end;
$$;

create function public.support_reply_member(p_user uuid, p_ticket uuid, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 update public.support_tickets set status = 'open', updated_at = now(),
  respond_by = coalesce(respond_by, now() + interval '24 hours')
 where id = p_ticket and user_id = p_user;
 if not found then raise exception 'ticket not found' using errcode = 'P0002'; end if;
 insert into public.support_messages (ticket_id, author_id, from_staff, body) values (p_ticket, p_user, false, trim(p_body));
end;
$$;

create function public.support_reply_staff(p_actor uuid, p_ticket uuid, p_body text, p_internal boolean, p_status text, p_request_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.support_tickets%rowtype;
begin
 if not exists (select from public.admin_roles where user_id = p_actor and role in ('owner', 'support', 'finance')) then
   raise exception 'support role required' using errcode = '42501';
 end if;
 if p_status not in ('open', 'waiting_on_user', 'resolved') then raise exception 'invalid status' using errcode = '22023'; end if;
 select * into t from public.support_tickets where id = p_ticket for update;
 if not found then raise exception 'ticket not found' using errcode = 'P0002'; end if;
 if nullif(trim(p_body), '') is not null then
   insert into public.support_messages (ticket_id, author_id, from_staff, internal, body)
   values (p_ticket, p_actor, true, coalesce(p_internal, false), trim(p_body));
 end if;
 update public.support_tickets set status = p_status, updated_at = now(), assigned_to = coalesce(assigned_to, p_actor),
  -- A public reply answers the member; the target clears until they write again.
  respond_by = case when nullif(trim(p_body), '') is not null and not coalesce(p_internal, false) then null else respond_by end
 where id = p_ticket;
 if nullif(trim(p_body), '') is not null and not coalesce(p_internal, false) then
   perform private.deliver_in_app(t.user_id, 'support_reply', p_ticket::text || ':' || pg_current_xact_id()::text, trim(t.subject));
 end if;
 if p_status is distinct from t.status then
   perform private.write_audit(p_actor, 'support.status', 'support_ticket', p_ticket::text,
    jsonb_build_object('status', t.status), jsonb_build_object('status', p_status), 'Support reply', p_request_id);
 end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Claim appeals: once per rejected claim, within 14 days, new evidence required.
-- ---------------------------------------------------------------------------------------------
create table public.claim_appeals (
 id uuid primary key default gen_random_uuid(),
 claim_id uuid not null unique references public.purchase_claims on delete cascade,
 user_id uuid references public.profiles on delete set null,
 evidence text not null check (length(trim(evidence)) between 20 and 4000),
 status text not null default 'pending' check (status in ('pending', 'upheld', 'overturned')),
 first_reviewer uuid references public.profiles on delete set null,
 decided_by uuid references public.profiles on delete set null,
 decision_note text check (length(decision_note) <= 1000),
 created_at timestamptz not null default now(),
 decided_at timestamptz
);
create index claim_appeals_queue on public.claim_appeals (status, created_at);
alter table public.claim_appeals enable row level security;
revoke all on public.claim_appeals from public, anon, authenticated, service_role;
grant select on public.claim_appeals to authenticated, service_role;
create policy appeals_own on public.claim_appeals for select to authenticated using (user_id = (select auth.uid()));

create function public.appeal_claim(p_user uuid, p_claim uuid, p_evidence text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c public.purchase_claims%rowtype; appeal uuid;
begin
 select * into c from public.purchase_claims where id = p_claim and user_id = p_user for update;
 if not found then raise exception 'claim not found' using errcode = 'P0002'; end if;
 if c.status <> 'rejected' or c.reviewed_at is null then raise exception 'only rejected claims can be appealed' using errcode = '23514'; end if;
 if c.reviewed_at < now() - interval '14 days' then raise exception 'appeal window closed' using errcode = '23514'; end if;
 perform private.assert_unrestricted(p_user);
 insert into public.claim_appeals (claim_id, user_id, evidence, first_reviewer)
 values (p_claim, p_user, trim(p_evidence), c.reviewed_by) returning id into appeal;
 return appeal;
exception when unique_violation then
 raise exception 'claim already appealed' using errcode = '23505';
end;
$$;

create function public.decide_appeal(p_actor uuid, p_appeal uuid, p_overturn boolean, p_note text, p_request_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.claim_appeals%rowtype; reviewers integer;
begin
 if not exists (select from public.admin_roles where user_id = p_actor and role in ('owner', 'finance', 'support'))
  or length(trim(coalesce(p_note, ''))) not between 3 and 1000 then
   raise exception 'review role and note required' using errcode = '42501';
 end if;
 select * into a from public.claim_appeals where id = p_appeal for update;
 if not found or a.status <> 'pending' then raise exception 'appeal not pending' using errcode = '40001'; end if;
 select count(distinct user_id) into reviewers from public.admin_roles where role in ('owner', 'finance', 'support');
 if reviewers > 1 and a.first_reviewer = p_actor then
   raise exception 'a different reviewer must decide this appeal' using errcode = '42501';
 end if;
 update public.claim_appeals set status = case when p_overturn then 'overturned' else 'upheld' end,
  decided_by = p_actor, decision_note = trim(p_note), decided_at = now() where id = p_appeal;
 if p_overturn then
   update public.purchase_claims set status = 'approved', review_note = trim(p_note), reviewed_by = p_actor, reviewed_at = now()
   where id = a.claim_id and status = 'rejected';
 end if;
 perform private.deliver_in_app(a.user_id, 'appeal_decided', p_appeal::text, case when p_overturn then 'overturned' else 'upheld' end);
 perform private.write_audit(p_actor, 'claim.appeal', 'claim', a.claim_id::text, jsonb_build_object('status', 'rejected'),
  jsonb_build_object('appeal', case when p_overturn then 'overturned' else 'upheld' end), p_note, p_request_id);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Data requests: export (built on demand) and deletion (email-confirmed, 14-day grace).
-- ---------------------------------------------------------------------------------------------
create table public.data_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references public.profiles on delete set null,
 kind text not null check (kind in ('export', 'delete')),
 status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
 confirm_hash text check (confirm_hash ~ '^[0-9a-f]{64}$'),
 requested_at timestamptz not null default now(),
 confirmed_at timestamptz,
 due_at timestamptz,
 completed_at timestamptz,
 completed_by uuid
);
create unique index data_requests_one_open_delete on public.data_requests (user_id) where kind = 'delete' and status in ('pending', 'confirmed');
create index data_requests_queue on public.data_requests (status, due_at);
alter table public.data_requests enable row level security;
revoke all on public.data_requests from public, anon, authenticated, service_role;
grant select on public.data_requests to service_role;
grant select (id, user_id, kind, status, requested_at, confirmed_at, due_at, completed_at) on public.data_requests to authenticated;
create policy data_requests_own on public.data_requests for select to authenticated using (user_id = (select auth.uid()));

create function public.record_export(p_user uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare r uuid;
begin
 insert into public.data_requests (user_id, kind, status, due_at, completed_at)
 values (p_user, 'export', 'completed', now(), now()) returning id into r;
 return r;
end;
$$;

-- Starts a deletion request; the email link carries the token whose hash is stored here.
create function public.request_deletion(p_user uuid, p_hash text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare r uuid;
begin
 update public.data_requests set confirm_hash = p_hash, requested_at = now()
 where user_id = p_user and kind = 'delete' and status = 'pending' returning id into r;
 if r is not null then return r; end if;
 if exists (select from public.data_requests where user_id = p_user and kind = 'delete' and status = 'confirmed') then
   raise exception 'deletion already scheduled' using errcode = '23505';
 end if;
 insert into public.data_requests (user_id, kind, confirm_hash) values (p_user, 'delete', p_hash) returning id into r;
 return r;
end;
$$;

create function public.confirm_deletion(p_user uuid, p_hash text) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare due timestamptz;
begin
 update public.data_requests set status = 'confirmed', confirmed_at = now(), due_at = now() + interval '14 days', confirm_hash = null
 where user_id = p_user and kind = 'delete' and status = 'pending' and confirm_hash = p_hash
  and requested_at > now() - interval '24 hours'
 returning due_at into due;
 if due is null then raise exception 'confirmation link invalid or expired' using errcode = 'P0002'; end if;
 perform private.deliver_in_app(p_user, 'data_request', 'delete:' || to_char(due, 'YYYY-MM-DD'), to_char(due, 'YYYY-MM-DD'));
 return due;
end;
$$;

create function public.cancel_deletion(p_user uuid) returns void
language sql security definer set search_path = '' as $$
 update public.data_requests set status = 'cancelled', confirm_hash = null
 where user_id = p_user and kind = 'delete' and status in ('pending', 'confirmed');
$$;

-- Erases personal fields that survive the account (claims keep their accounting rows).
-- Returns the storage paths the server must remove. The auth user is deleted by the server
-- afterwards; profile rows cascade.
create function public.erase_member(p_user uuid, p_actor uuid) returns table (bucket text, path text)
language plpgsql security definer set search_path = '' as $$
begin
 update public.data_requests set status = 'completed', completed_at = now(), completed_by = p_actor
 where user_id = p_user and kind = 'delete' and status = 'confirmed';
 return query
  select 'journal'::text, s.path from public.journal_screenshots s where s.user_id = p_user
  union all
  select 'receipts'::text, c.receipt_path from public.purchase_claims c where c.user_id = p_user and c.receipt_path is not null
   and not exists (select from public.commissions m where m.claim_id = c.id and m.status in ('confirmed', 'released'));
 update public.purchase_claims set checkout_email = null where user_id = p_user;
 -- Receipts behind confirmed commissions are financial records and stay until their retention ends.
 update public.purchase_claims c set receipt_path = null where c.user_id = p_user
  and not exists (select from public.commissions m where m.claim_id = c.id and m.status in ('confirmed', 'released'));
 update public.support_messages set body = '[removed at the member''s request]'
 where ticket_id in (select id from public.support_tickets where user_id = p_user) and not from_staff;
end;
$$;

create function public.due_deletions(p_limit integer) returns table (user_id uuid)
language sql stable security definer set search_path = '' as $$
 select user_id from public.data_requests where kind = 'delete' and status = 'confirmed' and due_at <= now()
 order by due_at limit least(greatest(p_limit, 1), 50);
$$;

revoke execute on function
 public.admin_save_article(uuid, uuid, text, text, text, text, text, text, text),
 public.admin_save_changelog(uuid, uuid, text, text, text, text),
 public.support_open(uuid, text, text, text, uuid, uuid), public.support_reply_member(uuid, uuid, text),
 public.support_reply_staff(uuid, uuid, text, boolean, text, text),
 public.appeal_claim(uuid, uuid, text), public.decide_appeal(uuid, uuid, boolean, text, text),
 public.record_export(uuid), public.request_deletion(uuid, text), public.confirm_deletion(uuid, text),
 public.cancel_deletion(uuid), public.erase_member(uuid, uuid), public.due_deletions(integer)
 from public, anon, authenticated;
grant execute on function
 public.admin_save_article(uuid, uuid, text, text, text, text, text, text, text),
 public.admin_save_changelog(uuid, uuid, text, text, text, text),
 public.support_open(uuid, text, text, text, uuid, uuid), public.support_reply_member(uuid, uuid, text),
 public.support_reply_staff(uuid, uuid, text, boolean, text, text),
 public.appeal_claim(uuid, uuid, text), public.decide_appeal(uuid, uuid, boolean, text, text),
 public.record_export(uuid), public.request_deletion(uuid, text), public.confirm_deletion(uuid, text),
 public.cancel_deletion(uuid), public.erase_member(uuid, uuid), public.due_deletions(integer)
 to service_role;

-- Starter help articles (owner edits them in admin). Plain facts about how the product works.
insert into public.help_articles (slug, category, title, summary, body, status) values
('how-claims-work', 'claims', 'How purchase claims work', 'What happens after you claim a purchase, and how long each step takes.',
 E'1. Buy a challenge through our link with our code.\n2. Claim the purchase with your order reference and receipt.\n3. We check the claim. You see its status on the Claims page.\n4. When the firm confirms our commission, your Coins appear as pending.\n5. After the hold period, pending Coins become available.\n\nIf a firm refunds or charges back a purchase, the Coins for it are reversed.', 'published'),
('appeal-a-claim', 'claims', 'Appeal a rejected claim', 'You can appeal a rejected claim once, within 14 days, with new evidence.',
 E'Open the Claims page and choose Appeal on the rejected claim. Explain what was missed and add the new evidence, such as a clearer receipt or the order confirmation email.\n\nA different reviewer decides the appeal when possible. You will see the decision in Notifications.', 'published'),
('coins-explained', 'coins', 'Coins: pending, available and expiry', 'How Coins move from pending to available, and when they expire.',
 E'Coins come from a share of the commission a firm confirms for your purchase. They are pending until the commission is confirmed and the hold period has passed, then available.\n\nCoins have no cash value and cannot be transferred. Available Coins expire after 12 months with no sign-in, earn or redemption. We warn you 30 days and 7 days before.', 'published'),
('redeem-rewards', 'rewards', 'Redeem Coins for rewards', 'How redemption works and what to do if a code is delayed.',
 E'Choose a reward on the Rewards page. If a code is in stock it appears straight away. If not, your redemption is queued and we aim to fulfil it within 48 hours. If we cannot, you can cancel and your Coins are returned.', 'published'),
('your-data', 'account', 'Export or delete your data', 'Download everything we hold about you, or delete your account.',
 E'Go to Profile, then Your data. Export downloads a ZIP of your profile, journal, Coin history, claims and redemptions.\n\nDeletion asks you to confirm by email, then waits 14 days so you can change your mind. After that your profile, journal and screenshots are deleted. Accounting records of Coins and claims are kept without your personal details.', 'published');
