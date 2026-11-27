-- Basic trading journal (docs/spec/15-trading-journal.md, 18-data-and-operations.md §2).
-- Journals are private: members read only their own rows; staff get no read grant.
-- Every write goes through a SECURITY DEFINER function called by the server, because saving a
-- trade also awards XP and moves the journal streak, which the client must never write.

create table public.journal_strategies (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles on delete cascade,
 name text not null check (length(trim(name)) between 1 and 80),
 description text check (length(description) <= 2000),
 archived_at timestamptz,
 created_at timestamptz not null default now(),
 unique (user_id, id)
);
create unique index journal_strategies_name on public.journal_strategies (user_id, lower(name)) where archived_at is null;

create table public.journal_strategy_rules (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null,
 strategy_id uuid not null,
 position smallint not null check (position between 0 and 19),
 body text not null check (length(trim(body)) between 1 and 200),
 foreign key (user_id, strategy_id) references public.journal_strategies (user_id, id) on delete cascade,
 unique (strategy_id, position),
 unique (user_id, id)
);
create index journal_strategy_rules_user on public.journal_strategy_rules (user_id, strategy_id);

create table public.journal_tags (
 id uuid primary key default gen_random_uuid(),
 -- Null for presets shared by everyone.
 user_id uuid references public.profiles on delete cascade,
 kind text not null check (kind in ('setup', 'mistake', 'emotion')),
 name text not null check (length(trim(name)) between 1 and 40),
 created_at timestamptz not null default now()
);
create unique index journal_tags_name on public.journal_tags
 (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, lower(name));
insert into public.journal_tags (kind, name) values
 ('mistake', 'Moved stop loss'), ('mistake', 'No stop loss'), ('mistake', 'Oversized lot'),
 ('mistake', 'Revenge trade'), ('mistake', 'Traded during news'), ('mistake', 'Broke daily plan'),
 ('mistake', 'Chased entry'), ('mistake', 'Closed early'), ('mistake', 'Held over weekend'),
 ('emotion', 'Calm'), ('emotion', 'Confident'), ('emotion', 'Fearful'),
 ('emotion', 'Greedy'), ('emotion', 'Frustrated'), ('emotion', 'Bored');

create table public.journal_trades (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles on delete cascade,
 source text not null default 'manual' check (source in ('manual', 'quick', 'import')),
 symbol text not null check (symbol ~ '^[A-Z0-9]{2,12}$'),
 direction text not null check (direction in ('long', 'short')),
 opened_at timestamptz,
 closed_at timestamptz not null,
 -- Day the trade closed in the member's timezone when it was saved; dashboards group by it.
 local_day date not null,
 lots numeric(12, 2) check (lots > 0),
 entry numeric(20, 8) check (entry > 0),
 exit numeric(20, 8) check (exit > 0),
 stop_loss numeric(20, 8) check (stop_loss > 0),
 take_profit numeric(20, 8) check (take_profit > 0),
 currency text not null check (currency ~ '^[A-Z]{3}$'),
 -- Profit or loss as shown for the position, in minor units. Commission and swap are signed
 -- (a cost is negative); the net result adds them.
 result_cents bigint not null check (abs(result_cents) <= 100000000000),
 commission_cents bigint not null default 0 check (abs(commission_cents) <= 100000000000),
 swap_cents bigint not null default 0 check (abs(swap_cents) <= 100000000000),
 net_cents bigint generated always as (result_cents + commission_cents + swap_cents) stored,
 pips numeric(14, 1),
 r_multiple numeric(10, 2),
 session text check (session in ('asia', 'london', 'new_york', 'overlap', 'off')),
 strategy_id uuid,
 emotion_before smallint check (emotion_before between 1 and 5),
 emotion_after smallint check (emotion_after between 1 and 5),
 confidence smallint check (confidence between 1 and 5),
 notes text check (length(notes) <= 4000),
 external_ticket text check (length(external_ticket) <= 64),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (opened_at is null or opened_at <= closed_at),
 foreign key (user_id, strategy_id) references public.journal_strategies (user_id, id) on delete set null (strategy_id),
 unique (user_id, id)
);
create index journal_trades_user_closed on public.journal_trades (user_id, closed_at desc);
create index journal_trades_user_day on public.journal_trades (user_id, local_day);
create index journal_trades_strategy on public.journal_trades (user_id, strategy_id);
create unique index journal_trades_ticket on public.journal_trades (user_id, external_ticket) where external_ticket is not null;

create table public.journal_trade_tags (
 user_id uuid not null,
 trade_id uuid not null,
 tag_id uuid not null references public.journal_tags on delete cascade,
 primary key (trade_id, tag_id),
 foreign key (user_id, trade_id) references public.journal_trades (user_id, id) on delete cascade
);
create index journal_trade_tags_tag on public.journal_trade_tags (tag_id);
create index journal_trade_tags_user on public.journal_trade_tags (user_id, trade_id);

create table public.journal_trade_rule_checks (
 user_id uuid not null,
 trade_id uuid not null,
 rule_id uuid not null,
 followed boolean not null,
 primary key (trade_id, rule_id),
 foreign key (user_id, trade_id) references public.journal_trades (user_id, id) on delete cascade,
 foreign key (user_id, rule_id) references public.journal_strategy_rules (user_id, id) on delete cascade
);
create index journal_rule_checks_rule on public.journal_trade_rule_checks (user_id, rule_id);

create table public.journal_screenshots (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null,
 trade_id uuid not null,
 path text not null unique check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png)$'),
 bytes integer not null check (bytes between 1 and 2097152),
 created_at timestamptz not null default now(),
 foreign key (user_id, trade_id) references public.journal_trades (user_id, id) on delete cascade
);
create index journal_screenshots_trade on public.journal_screenshots (user_id, trade_id);

create table public.journal_daily_stats (
 user_id uuid not null references public.profiles on delete cascade,
 local_day date not null,
 currency text not null,
 trades integer not null,
 wins integer not null,
 losses integer not null,
 net_cents bigint not null,
 r_sum numeric(14, 2) not null,
 best_cents bigint not null,
 worst_cents bigint not null,
 primary key (user_id, local_day, currency)
);

create table public.journal_days (
 user_id uuid not null references public.profiles on delete cascade,
 local_day date not null,
 reason text not null check (reason in ('trade', 'no_trades')),
 created_at timestamptz not null default now(),
 primary key (user_id, local_day)
);

create table public.journal_streaks (
 user_id uuid primary key references public.profiles on delete cascade,
 last_day date not null,
 current_streak integer not null check (current_streak > 0),
 longest integer not null,
 last_weekly_freeze date
);

alter table public.journal_strategies enable row level security;
alter table public.journal_strategy_rules enable row level security;
alter table public.journal_tags enable row level security;
alter table public.journal_trades enable row level security;
alter table public.journal_trade_tags enable row level security;
alter table public.journal_trade_rule_checks enable row level security;
alter table public.journal_screenshots enable row level security;
alter table public.journal_daily_stats enable row level security;
alter table public.journal_days enable row level security;
alter table public.journal_streaks enable row level security;

revoke all on public.journal_strategies, public.journal_strategy_rules, public.journal_tags, public.journal_trades,
 public.journal_trade_tags, public.journal_trade_rule_checks, public.journal_screenshots, public.journal_daily_stats,
 public.journal_days, public.journal_streaks from public, anon, authenticated, service_role;
grant select on public.journal_strategies, public.journal_strategy_rules, public.journal_tags, public.journal_trades,
 public.journal_trade_tags, public.journal_trade_rule_checks, public.journal_screenshots, public.journal_daily_stats,
 public.journal_days, public.journal_streaks to authenticated, service_role;
-- Members read through their own session (RLS). The server's service role reads only for
-- data export and staff counts; staff screens never show journal content (18-data-and-operations §2).

create policy journal_strategies_own on public.journal_strategies for select to authenticated using (user_id = (select auth.uid()));
create policy journal_rules_own on public.journal_strategy_rules for select to authenticated using (user_id = (select auth.uid()));
create policy journal_tags_visible on public.journal_tags for select to authenticated using (user_id is null or user_id = (select auth.uid()));
create policy journal_trades_own on public.journal_trades for select to authenticated using (user_id = (select auth.uid()));
create policy journal_trade_tags_own on public.journal_trade_tags for select to authenticated using (user_id = (select auth.uid()));
create policy journal_rule_checks_own on public.journal_trade_rule_checks for select to authenticated using (user_id = (select auth.uid()));
create policy journal_screenshots_own on public.journal_screenshots for select to authenticated using (user_id = (select auth.uid()));
create policy journal_stats_own on public.journal_daily_stats for select to authenticated using (user_id = (select auth.uid()));
create policy journal_days_own on public.journal_days for select to authenticated using (user_id = (select auth.uid()));
create policy journal_streaks_own on public.journal_streaks for select to authenticated using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('journal', 'journal', false, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into public.missions (key, title, period, criteria, xp, enabled) values
 ('journal_first', 'Log your first trade', 'once', '{"event":"journal_trade_logged"}', 50, true);

-- Summary rows for one member, day and currency, recomputed from the trades.
create function private.journal_refresh_day(p_user uuid, p_day date, p_currency text) returns void
language plpgsql set search_path = '' as $$
begin
 delete from public.journal_daily_stats where user_id = p_user and local_day = p_day and currency = p_currency;
 insert into public.journal_daily_stats (user_id, local_day, currency, trades, wins, losses, net_cents, r_sum, best_cents, worst_cents)
 select p_user, p_day, p_currency, count(*), count(*) filter (where net_cents > 0), count(*) filter (where net_cents < 0),
  sum(net_cents), coalesce(sum(r_multiple), 0), max(net_cents), min(net_cents)
 from public.journal_trades where user_id = p_user and local_day = p_day and currency = p_currency
 having count(*) > 0;
end;
$$;

create function private.journal_stats_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if tg_op in ('UPDATE', 'DELETE') then
   perform private.journal_refresh_day(old.user_id, old.local_day, old.currency);
 end if;
 if tg_op in ('INSERT', 'UPDATE') then
   perform private.journal_refresh_day(new.user_id, new.local_day, new.currency);
 end if;
 return null;
end;
$$;
create trigger journal_trades_stats after insert or update or delete on public.journal_trades
 for each row execute function private.journal_stats_trigger();

-- Marks today as a journal day and moves the journal streak (one free freeze a week).
-- Days are the member's current local day, so backdated trades cannot rebuild a streak.
create function private.journal_mark_day(p_user uuid, p_reason text, p_now timestamptz) returns date
language plpgsql set search_path = '' as $$
declare d date; previous public.journal_streaks%rowtype; streak integer := 1; weekly date; missed_week date;
begin
 select private.local_day(p_now, timezone) into strict d from public.profiles where id = p_user and onboarded_at is not null;
 insert into public.journal_days (user_id, local_day, reason) values (p_user, d, p_reason) on conflict do nothing;
 if not found then return d; end if;
 select * into previous from public.journal_streaks where user_id = p_user;
 if found then
   weekly := previous.last_weekly_freeze;
   if d <= previous.last_day then return d; end if;
   missed_week := date_trunc('week', (d - 1)::timestamp)::date;
   if d = previous.last_day + 1 then
     streak := previous.current_streak + 1;
   elsif d = previous.last_day + 2 and weekly is distinct from missed_week then
     streak := previous.current_streak + 1;
     weekly := missed_week;
   end if;
 end if;
 insert into public.journal_streaks as s (user_id, last_day, current_streak, longest, last_weekly_freeze)
 values (p_user, d, streak, streak, weekly)
 on conflict (user_id) do update set last_day = d, current_streak = streak, longest = greatest(s.longest, streak), last_weekly_freeze = weekly;
 return d;
end;
$$;

-- Creates or edits a trade with its tags and strategy rule checks. Returns the trade id.
-- XP: 5 for a trade with a tag or a note, at most 10 trades a day, within the daily XP cap.
-- Pips, R-multiple and session are computed by the server (src/lib/journal/compute.ts).
create function public.journal_save_trade(
 p_user uuid, p_id uuid, p_source text, p_symbol text, p_direction text,
 p_opened_at timestamptz, p_closed_at timestamptz, p_lots numeric, p_entry numeric, p_exit numeric,
 p_stop_loss numeric, p_take_profit numeric, p_currency text, p_result_cents bigint,
 p_commission_cents bigint, p_swap_cents bigint, p_pips numeric, p_r_multiple numeric, p_session text,
 p_strategy uuid, p_emotion_before smallint, p_emotion_after smallint, p_confidence smallint, p_notes text,
 p_tags uuid[], p_rules_followed uuid[], p_rules_broken uuid[]
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare trade_id uuid; zone text; d date; tag_count integer; rule_count integer; logged integer; total integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
 select timezone into strict zone from public.profiles where id = p_user and onboarded_at is not null;
 if p_closed_at > now() + interval '5 minutes' then raise exception 'trade closes in the future' using errcode = '22023'; end if;
 d := private.local_day(p_closed_at, zone);
 if p_id is null then
   insert into public.journal_trades (user_id, source, symbol, direction, opened_at, closed_at, local_day, lots, entry, exit,
    stop_loss, take_profit, currency, result_cents, commission_cents, swap_cents, pips, r_multiple, session, strategy_id,
    emotion_before, emotion_after, confidence, notes)
   values (p_user, p_source, upper(p_symbol), p_direction, p_opened_at, p_closed_at, d, p_lots, p_entry, p_exit,
    p_stop_loss, p_take_profit, upper(p_currency), p_result_cents, coalesce(p_commission_cents, 0), coalesce(p_swap_cents, 0),
    p_pips, p_r_multiple, p_session, p_strategy, p_emotion_before, p_emotion_after, p_confidence, nullif(trim(p_notes), ''))
   returning id into trade_id;
 else
   update public.journal_trades set symbol = upper(p_symbol), direction = p_direction, opened_at = p_opened_at,
    closed_at = p_closed_at, local_day = d, lots = p_lots, entry = p_entry, exit = p_exit, stop_loss = p_stop_loss,
    take_profit = p_take_profit, currency = upper(p_currency), result_cents = p_result_cents,
    commission_cents = coalesce(p_commission_cents, 0), swap_cents = coalesce(p_swap_cents, 0), pips = p_pips,
    r_multiple = p_r_multiple, session = p_session, strategy_id = p_strategy, emotion_before = p_emotion_before,
    emotion_after = p_emotion_after, confidence = p_confidence, notes = nullif(trim(p_notes), ''), updated_at = now()
   where id = p_id and user_id = p_user returning id into trade_id;
   if trade_id is null then raise exception 'trade not found' using errcode = 'P0002'; end if;
   delete from public.journal_trade_tags where journal_trade_tags.trade_id = p_id;
   delete from public.journal_trade_rule_checks where journal_trade_rule_checks.trade_id = p_id;
 end if;

 if cardinality(coalesce(p_tags, '{}')) > 20 then raise exception 'too many tags' using errcode = '22023'; end if;
 insert into public.journal_trade_tags (user_id, trade_id, tag_id)
 select p_user, trade_id, t.id from public.journal_tags t
 where t.id = any (coalesce(p_tags, '{}')) and (t.user_id is null or t.user_id = p_user);
 get diagnostics tag_count = row_count;
 if tag_count <> cardinality(array(select distinct unnest(coalesce(p_tags, '{}')))) then
   raise exception 'unknown tag' using errcode = '22023';
 end if;

 if (cardinality(coalesce(p_rules_followed, '{}')) + cardinality(coalesce(p_rules_broken, '{}'))) > 0 then
   if p_strategy is null then raise exception 'rules need a strategy' using errcode = '22023'; end if;
   insert into public.journal_trade_rule_checks (user_id, trade_id, rule_id, followed)
   select p_user, trade_id, r.id, r.id = any (coalesce(p_rules_followed, '{}'))
   from public.journal_strategy_rules r
   where r.user_id = p_user and r.strategy_id = p_strategy
    and (r.id = any (coalesce(p_rules_followed, '{}')) or r.id = any (coalesce(p_rules_broken, '{}')));
   get diagnostics rule_count = row_count;
   if rule_count <> cardinality(coalesce(p_rules_followed, '{}')) + cardinality(coalesce(p_rules_broken, '{}')) then
     raise exception 'unknown rule' using errcode = '22023';
   end if;
 end if;

 if tag_count > 0 or nullif(trim(p_notes), '') is not null then
   d := private.journal_mark_day(p_user, 'trade', now());
   select count(*) into logged from public.xp_events where user_id = p_user and source = 'journal_trade'
    and created_at >= d::timestamp at time zone zone and created_at < (d + 1)::timestamp at time zone zone;
   if logged < 10 then
     perform private.award_engagement(p_user, 'journal_trade', 'journal:trade:' || trade_id, 5, now());
   end if;
   perform public.record_mission_event(p_user, 'journal_trade_logged');
 end if;

 select count(*) into total from public.journal_trades where user_id = p_user;
 if total >= 1 then insert into public.user_badges (user_id, badge) values (p_user, 'journal_first') on conflict do nothing; end if;
 if total >= 100 then insert into public.user_badges (user_id, badge) values (p_user, 'journal_100') on conflict do nothing; end if;
 return trade_id;
end;
$$;

create function public.journal_no_trades(p_user uuid) returns date
language plpgsql security definer set search_path = '' as $$
declare d date;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
 d := private.journal_mark_day(p_user, 'no_trades', now());
 perform private.award_engagement(p_user, 'journal_none', 'journal:none:' || p_user || ':' || d, 5, now());
 return d;
end;
$$;

-- Deletes a trade and returns its screenshot paths so the server can remove the files.
create function public.journal_delete_trade(p_user uuid, p_id uuid) returns setof text
language plpgsql security definer set search_path = '' as $$
declare paths text[];
begin
 select coalesce(array_agg(path), '{}') into paths from public.journal_screenshots where user_id = p_user and trade_id = p_id;
 delete from public.journal_trades where id = p_id and user_id = p_user;
 if not found then raise exception 'trade not found' using errcode = 'P0002'; end if;
 return query select unnest(paths);
end;
$$;

create function public.journal_add_screenshot(p_user uuid, p_trade uuid, p_path text, p_bytes integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare shot uuid;
begin
 perform 1 from public.journal_trades where id = p_trade and user_id = p_user for update;
 if not found then raise exception 'trade not found' using errcode = 'P0002'; end if;
 if split_part(p_path, '/', 1) <> p_user::text or split_part(p_path, '/', 2) <> p_trade::text then
   raise exception 'path outside the member folder' using errcode = '42501';
 end if;
 if (select count(*) from public.journal_screenshots where trade_id = p_trade) >= 4 then
   raise exception 'screenshot limit' using errcode = '23514';
 end if;
 insert into public.journal_screenshots (user_id, trade_id, path, bytes) values (p_user, p_trade, p_path, p_bytes) returning id into shot;
 return shot;
end;
$$;

create function public.journal_remove_screenshot(p_user uuid, p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare removed text;
begin
 delete from public.journal_screenshots where id = p_id and user_id = p_user returning path into removed;
 if removed is null then raise exception 'screenshot not found' using errcode = 'P0002'; end if;
 return removed;
end;
$$;

-- Creates or edits a strategy. Rules are kept by position so earlier rule checks stay linked.
create function public.journal_save_strategy(p_user uuid, p_id uuid, p_name text, p_description text, p_rules text[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare sid uuid; n integer := cardinality(coalesce(p_rules, '{}'));
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
 if n > 20 then raise exception 'too many rules' using errcode = '22023'; end if;
 if p_id is null then
   if (select count(*) from public.journal_strategies where user_id = p_user and archived_at is null) >= 50 then
     raise exception 'strategy limit' using errcode = '23514';
   end if;
   insert into public.journal_strategies (user_id, name, description)
   values (p_user, trim(p_name), nullif(trim(p_description), '')) returning id into sid;
 else
   update public.journal_strategies set name = trim(p_name), description = nullif(trim(p_description), '')
   where id = p_id and user_id = p_user and archived_at is null returning id into sid;
   if sid is null then raise exception 'strategy not found' using errcode = 'P0002'; end if;
 end if;
 delete from public.journal_strategy_rules where strategy_id = sid and position >= n;
 insert into public.journal_strategy_rules as r (user_id, strategy_id, position, body)
 select p_user, sid, (i - 1)::smallint, trim(p_rules[i]) from generate_subscripts(coalesce(p_rules, '{}'), 1) i
 on conflict (strategy_id, position) do update set body = excluded.body;
 return sid;
end;
$$;

create function public.journal_archive_strategy(p_user uuid, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 update public.journal_strategies set archived_at = now() where id = p_id and user_id = p_user and archived_at is null;
 if not found then raise exception 'strategy not found' using errcode = 'P0002'; end if;
end;
$$;

create function public.journal_create_tag(p_user uuid, p_kind text, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare tag uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
 select id into tag from public.journal_tags
 where (user_id is null or user_id = p_user) and kind = p_kind and lower(name) = lower(trim(p_name));
 if found then return tag; end if;
 if (select count(*) from public.journal_tags where user_id = p_user) >= 100 then
   raise exception 'tag limit' using errcode = '23514';
 end if;
 insert into public.journal_tags (user_id, kind, name) values (p_user, p_kind, trim(p_name)) returning id into tag;
 return tag;
end;
$$;

create function public.journal_delete_tag(p_user uuid, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 delete from public.journal_tags where id = p_id and user_id = p_user;
 if not found then raise exception 'tag not found' using errcode = 'P0002'; end if;
end;
$$;

revoke execute on function private.journal_refresh_day(uuid, date, text), private.journal_stats_trigger(),
 private.journal_mark_day(uuid, text, timestamptz),
 public.journal_save_trade(uuid, uuid, text, text, text, timestamptz, timestamptz, numeric, numeric, numeric, numeric, numeric,
  text, bigint, bigint, bigint, numeric, numeric, text, uuid, smallint, smallint, smallint, text, uuid[], uuid[], uuid[]),
 public.journal_no_trades(uuid), public.journal_delete_trade(uuid, uuid), public.journal_add_screenshot(uuid, uuid, text, integer),
 public.journal_remove_screenshot(uuid, uuid), public.journal_save_strategy(uuid, uuid, text, text, text[]),
 public.journal_archive_strategy(uuid, uuid), public.journal_create_tag(uuid, text, text), public.journal_delete_tag(uuid, uuid)
 from public, anon, authenticated;
grant execute on function
 public.journal_save_trade(uuid, uuid, text, text, text, timestamptz, timestamptz, numeric, numeric, numeric, numeric, numeric,
  text, bigint, bigint, bigint, numeric, numeric, text, uuid, smallint, smallint, smallint, text, uuid[], uuid[], uuid[]),
 public.journal_no_trades(uuid), public.journal_delete_trade(uuid, uuid), public.journal_add_screenshot(uuid, uuid, text, integer),
 public.journal_remove_screenshot(uuid, uuid), public.journal_save_strategy(uuid, uuid, text, text, text[]),
 public.journal_archive_strategy(uuid, uuid), public.journal_create_tag(uuid, text, text), public.journal_delete_tag(uuid, uuid)
 to service_role;
