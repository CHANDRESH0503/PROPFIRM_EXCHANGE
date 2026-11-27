create table public.engagement_config (
 id boolean primary key default true check(id),
 daily_cap integer not null check(daily_cap>0), checkin_xp integer not null check(checkin_xp>0),
 mission_xp integer not null check(mission_xp>=0), daily_set_bonus integer not null check(daily_set_bonus>=0)
);
insert into public.engagement_config values(true,150,10,20,30);
create table public.checkins (
 user_id uuid not null references public.profiles on delete cascade,
 local_day date not null,streak integer not null check(streak>0),awarded_xp integer not null,
 freezes_used integer not null default 0,created_at timestamptz not null default now(),primary key(user_id,local_day)
);
create table public.streaks (
 user_id uuid primary key references public.profiles on delete cascade,
 last_day date not null, current_streak integer not null, longest integer not null,
 saved_freezes integer not null default 0, last_weekly_freeze date
);
create table public.user_boosters(
 user_id uuid not null references public.profiles on delete cascade,
 kind text not null check(kind in('giveback','xp')),value integer not null,expires_at timestamptz,
 primary key(user_id,kind)
);
create table public.user_badges(
 user_id uuid not null references public.profiles on delete cascade,
 badge text not null,awarded_at timestamptz not null default now(),primary key(user_id,badge)
);
alter table public.engagement_config enable row level security;
alter table public.checkins enable row level security;
alter table public.streaks enable row level security;
alter table public.user_boosters enable row level security;
alter table public.user_badges enable row level security;
revoke all on public.engagement_config,public.checkins,public.streaks,public.user_boosters,public.user_badges from public,anon,authenticated,service_role;
grant select on public.engagement_config,public.checkins,public.streaks,public.user_boosters,public.user_badges to service_role,authenticated;
create policy xp_rules_read on public.engagement_config for select to authenticated using(true);
create policy checkins_read on public.checkins for select to authenticated using(user_id=(select auth.uid()));
create policy streak_read on public.streaks for select to authenticated using(user_id=(select auth.uid()));
create policy boosters_read on public.user_boosters for select to authenticated using(user_id=(select auth.uid()));
create policy badges_read on public.user_badges for select to authenticated using(user_id=(select auth.uid()));

create function private.local_day(at_time timestamptz,zone text) returns date
 language sql stable strict set search_path='' as $$ select (at_time at time zone zone)::date; $$;
create function private.award_engagement(p_user uuid,p_source text,p_key text,p_xp integer,p_now timestamptz)
returns integer language plpgsql set search_path='' as $$
declare zone text; d date; earned integer; room integer; amount_left integer; multiplier integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select amount into earned from public.xp_events where idempotency_key=p_key;
 if found then return earned; end if;
 select timezone into strict zone from public.profiles where id=p_user and onboarded_at is not null;
 d:=private.local_day(p_now,zone);
 select daily_cap into strict room from public.engagement_config;
 select coalesce(sum(amount),0) into earned from public.xp_events where user_id=p_user
  and created_at>=d::timestamp at time zone zone and created_at<(d+1)::timestamp at time zone zone
  and source not in('verified_purchase','verified_referral');
 select value into multiplier from public.user_boosters where user_id=p_user and kind='xp' and expires_at>p_now;
 amount_left:=least(greatest(0,room-earned),p_xp*coalesce(multiplier,1));
 if amount_left>0 then insert into public.xp_events(user_id,amount,source,idempotency_key,created_at) values(p_user,amount_left,p_source,p_key,p_now); end if;
 return amount_left;
end;
$$;
create function private.check_in_at(p_user uuid,p_now timestamptz) returns public.checkins
language plpgsql set search_path='' as $$
declare d date; previous public.streaks%rowtype; entry public.checkins%rowtype;
 gap integer; streak integer:=1; used integer:=0; bank integer:=0; weekly date; free_week date; base integer; xp integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select private.local_day(p_now,timezone) into strict d from public.profiles where id=p_user and onboarded_at is not null;
 select * into entry from public.checkins where user_id=p_user and local_day=d;
 if found then return entry; end if;
 select * into previous from public.streaks where user_id=p_user;
 if found then
   if d<=previous.last_day then raise exception 'day already passed'; end if;
   gap:=d-previous.last_day-1;
   bank:=previous.saved_freezes;weekly:=previous.last_weekly_freeze;
   free_week:=date_trunc('week',(d-1)::timestamp)::date;
   if gap=0 then streak:=previous.current_streak+1;
   elsif gap<=bank+(weekly is distinct from free_week)::integer then
     used:=gap;streak:=previous.current_streak+1;
     if weekly is distinct from free_week then weekly:=free_week;gap:=gap-1;end if;
     bank:=bank-gap;
   end if;
 end if;
 select checkin_xp into strict base from public.engagement_config;
 xp:=private.award_engagement(p_user,'checkin','checkin:'||p_user||':'||d,
  case when streak>=30 then base*2 when streak>=7 then base*3/2 else base end,p_now);
 if streak=3 then bank:=bank+1; end if;
 if streak in (7,30,60,100) then
   insert into public.user_badges(user_id,badge) values(p_user,'streak_'||streak) on conflict do nothing;
   insert into public.user_boosters as b(user_id,kind,value) values(p_user,'giveback',case when streak=7 then 300 else 500 end)
   on conflict(user_id,kind) do update set value=greatest(b.value,excluded.value);
 end if;
 if streak=14 then
   insert into public.user_boosters(user_id,kind,value,expires_at) values(p_user,'xp',2,p_now+interval '24 hours')
   on conflict(user_id,kind) do update set expires_at=excluded.expires_at;
 end if;
 insert into public.streaks as s(user_id,last_day,current_streak,longest,saved_freezes,last_weekly_freeze)
 values(p_user,d,streak,streak,bank,weekly) on conflict(user_id) do update set last_day=d,current_streak=streak,
 longest=greatest(s.longest,streak),saved_freezes=bank,last_weekly_freeze=weekly;
 insert into public.checkins(user_id,local_day,streak,awarded_xp,freezes_used,created_at)
 values(p_user,d,streak,xp,used,p_now) returning * into entry;
 return entry;
end;
$$;
create function public.daily_checkin(p_user uuid) returns public.checkins language sql security definer set search_path=''
 as $$ select private.check_in_at(p_user,now()); $$;
create function public.trader_progress(p_user uuid) returns table(xp bigint,purchases integer,tier smallint,level_name text,
 next_xp integer,next_purchases integer,local_day date,streak integer,checked_in boolean)
language sql stable security definer set search_path='' as $$
 with counts as (select coalesce((select sum(amount) from public.xp_events where user_id=p_user),0) total,
 (select count(*)::integer from public.purchase_claims where user_id=p_user and status in('confirmed','released','reversed')) buys),
 level as(select l.* from public.levels l,counts c where (l.min_purchases<=c.buys and l.min_xp<=c.total)
 or exists(select from private.founding_members where user_id=p_user and black_until>now()) order by l.tier desc limit 1)
 select c.total,c.buys,l.tier,l.name,n.min_xp,n.min_purchases,private.local_day(now(),p.timezone),
 coalesce(s.current_streak,0),coalesce(s.last_day=private.local_day(now(),p.timezone),false)
 from counts c cross join level l left join public.levels n on n.tier=l.tier+1
 join public.profiles p on p.id=p_user left join public.streaks s on s.user_id=p.id;
$$;
revoke execute on function private.local_day(timestamptz,text),private.award_engagement(uuid,text,text,integer,timestamptz),
 private.check_in_at(uuid,timestamptz),public.daily_checkin(uuid),public.trader_progress(uuid) from public,anon,authenticated;
grant execute on function public.daily_checkin(uuid),public.trader_progress(uuid) to service_role;

-- Consume the held booster atomically when confirming a purchase outside the season.
create or replace function public.confirm_commission(p_actor uuid,p_id uuid,p_reason text,p_request_id text,p_cap_reviewed boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 com public.commissions%rowtype; claim public.purchase_claims%rowtype; cfg public.economy_config%rowtype;
 tier integer; buys integer; referrer uuid; wallet uuid; boost integer:=0; allocation record; season boolean:=false; monthly bigint;
begin
 if not exists(select from public.admin_roles where user_id=p_actor and role in('finance','owner'))
 or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'finance permission and reason required' using errcode='42501'; end if;
 select * into strict com from public.commissions where id=p_id for update;
 if com.status in('confirmed','released') then return com.claim_id; end if;
 if com.status<>'reported' then raise exception 'report reversed'; end if;
 select * into strict claim from public.purchase_claims where firm_id=com.firm_id and upper(trim(order_ref))=upper(trim(com.order_ref)) for update;
 if claim.status<>'approved' or claim.user_id is null or claim.currency<>'USD' or not exists(
  select from public.firm_agreements a join public.firms f on f.id=a.firm_id where f.id=com.firm_id and a.rebate_permission and not f.is_sample
 ) then raise exception 'approved eligible USD purchase required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(claim.user_id::text,0));
 select * into strict cfg from public.economy_config where effective_at<=now() order by effective_at desc limit 1;
 select count(*) into buys from public.purchase_claims where user_id=claim.user_id and status in('confirmed','released','reversed');
 select max(l.tier) into tier from public.levels l where l.min_purchases<=buys
 and l.min_xp<=(select coalesce(sum(amount),0) from public.xp_events where user_id=claim.user_id);
 if cfg.founding_starts_at<=now() and now()<cfg.founding_starts_at+make_interval(days=>cfg.founding_days) then
   perform pg_advisory_xact_lock(1709249);
   season:=(select count(*) from private.founding_members)<cfg.founding_buyers;
   if season then
     insert into private.founding_members(user_id,black_until)
     values(claim.user_id,cfg.founding_starts_at+make_interval(days=>cfg.founding_days)+interval '12 months')
     on conflict do nothing;
   end if;
 end if;
 if exists(select from private.founding_members where user_id=claim.user_id and black_until>now()) then tier:=5; end if;
 if not season then
   delete from public.user_boosters where user_id=claim.user_id and kind='giveback' returning value into boost;
 end if;
 if buys=0 then select referred_by into referrer from public.profiles where id=claim.user_id; end if;
 select * into allocation from private.coin_split(com.amount_cents,case when season then cfg.founding_share_bps else cfg.level_share_bps[tier] end,
   coalesce(boost,0),season,case when referrer is null then 0 else cfg.referral_bps end,0,cfg.max_total_giveback_bps);
 wallet:=private.wallet_for(claim.user_id);
 select coalesce(sum(amount),0) into monthly from public.ledger_entries where wallet_id=wallet and type in('purchase','referral')
 and created_at>=date_trunc('month',now(),'UTC');
 if monthly+allocation.buyer>cfg.monthly_cap and not coalesce(p_cap_reviewed,false) then raise exception 'monthly cap requires finance review'; end if;
 update public.commissions set status='confirmed',claim_id=claim.id,confirmed_at=now(),config_version=cfg.version,
 release_at=((claim.purchased_on+cfg.hold_days)::timestamp at time zone 'UTC') where id=p_id;
 if allocation.buyer>0 then
 insert into public.ledger_entries(wallet_id,amount,bucket,type,ref_type,ref_id,idempotency_key,config_version,created_by)
 values(wallet,allocation.buyer,'pending','purchase','commission',p_id,p_id||':buyer',cfg.version,p_actor);
 end if;
 if allocation.referral>0 then
 insert into public.ledger_entries(wallet_id,amount,bucket,type,ref_type,ref_id,idempotency_key,config_version,created_by)
 values(private.wallet_for(referrer),allocation.referral,'pending','referral','commission',p_id,p_id||':referral',cfg.version,p_actor);
 end if;
 insert into public.xp_events(user_id,amount,source,idempotency_key) values(claim.user_id,500,'verified_purchase',p_id||':purchase-xp');
 if referrer is not null then insert into public.xp_events(user_id,amount,source,idempotency_key) values(referrer,300,'verified_referral',p_id||':referral-xp'); end if;
 update public.purchase_claims set status='confirmed' where id=claim.id;
 perform private.write_audit(p_actor,'commission.confirm','commission',p_id::text,null,jsonb_build_object('claim',claim.id,'cap_reviewed',p_cap_reviewed),p_reason,p_request_id);
 return claim.id;
end;
$$;

create table public.missions (
 key text primary key,title text not null,period text not null check(period in('once','daily','weekly')),
 criteria jsonb not null check(jsonb_typeof(criteria)='object'), xp integer not null check(xp between 0 and 150),enabled boolean not null default true
);
create table public.mission_progress (
 user_id uuid not null references public.profiles on delete cascade,
 mission text not null references public.missions,period_key text not null,awarded_xp integer not null,completed_at timestamptz not null default now(),
 primary key(user_id,mission,period_key)
);
create index mission_progress_mission on public.mission_progress(mission);
insert into public.missions values
 ('profile','Complete your profile','once','{"event":"profile_completed"}',50,true),
 ('deals','View today’s deals','daily','{"event":"deals_viewed"}',20,true),
 ('compare','Compare two programs','daily','{"event":"programs_compared"}',20,true),
 ('calculator','Use a calculator','daily','{"event":"calculator_used"}',20,true);
alter table public.missions enable row level security;
alter table public.mission_progress enable row level security;
revoke all on public.missions,public.mission_progress from public,anon,authenticated,service_role;
grant select on public.missions,public.mission_progress to service_role,authenticated;
create policy missions_read on public.missions for select to authenticated using(enabled);
create policy mission_progress_read on public.mission_progress for select to authenticated using(user_id=(select auth.uid()));
create function public.record_mission_event(p_user uuid,p_event text) returns void language plpgsql security definer set search_path='' as $$
declare d date; m public.missions%rowtype; k text; earned integer; config public.engagement_config%rowtype;
begin
 select private.local_day(now(),timezone) into strict d from public.profiles where id=p_user and onboarded_at is not null;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 for m in select * from public.missions where enabled and criteria->>'event'=p_event and period in('once','daily') loop
   k:=case when m.period='once' then 'once' else d::text end;
   if not exists(select from public.mission_progress where user_id=p_user and mission=m.key and period_key=k) then
     earned:=private.award_engagement(p_user,'mission',p_user||':mission:'||m.key||':'||k,m.xp,now());
     insert into public.mission_progress(user_id,mission,period_key,awarded_xp) values(p_user,m.key,k,earned);
   end if;
 end loop;
 if exists(select from public.missions where period='daily' and enabled) and not exists(
  select from public.missions active where active.enabled and active.period='daily' and not exists(
   select from public.mission_progress p where p.user_id=p_user and p.mission=active.key and p.period_key=d::text)
 ) then
   select * into strict config from public.engagement_config;
   perform private.award_engagement(p_user,'mission',p_user||':daily-set:'||d,config.daily_set_bonus,now());
 end if;
end;
$$;
revoke execute on function public.record_mission_event(uuid,text) from public,anon,authenticated;
grant execute on function public.record_mission_event(uuid,text) to service_role;
create function private.profile_mission() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform public.record_mission_event(new.id,'profile_completed');
 return new;
end;
$$;
revoke execute on function private.profile_mission() from public,anon,authenticated;
create trigger onboarding_mission after update of onboarded_at on public.profiles for each row
when (old.onboarded_at is null and new.onboarded_at is not null) execute function private.profile_mission();
