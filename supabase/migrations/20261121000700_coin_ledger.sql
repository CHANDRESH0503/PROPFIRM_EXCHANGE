alter table public.economy_config
 add column monthly_cap integer not null default 50000 check(monthly_cap>=0),
 add column founding_starts_at timestamptz,
 add column founding_days integer not null default 90 check(founding_days>0),
 add column founding_buyers integer not null default 1000 check(founding_buyers>0);

create function private.coin_split(cents integer,base integer,boost integer,season boolean,ref integer,creator_rate integer,cap integer)
returns table(buyer integer, referral integer, creator integer)
language plpgsql immutable strict set search_path='' as $$
declare b integer; r integer; c integer;
begin
 if cents<0 or least(base,boost,ref,creator_rate,cap)<0 or greatest(base,boost,ref,creator_rate,cap)>10000 then
   raise exception 'invalid commission calculation';
 end if;
 b:=least(cap,base+case when season then 0 else boost end);
 r:=least(ref,cap-b);
 c:=least(creator_rate,cap-b-r);
 return query select (cents::bigint*b/10000)::int,(cents::bigint*r/10000)::int,(cents::bigint*c/10000)::int;
end;
$$;

-- Keep an accounting identifier when a profile is erased. Ledger entries never need to change.
create table public.wallet_accounts(
 id uuid primary key default gen_random_uuid(),
 user_id uuid unique references public.profiles on delete set null
);
create table public.commissions(
 id uuid primary key default gen_random_uuid(),
 firm_id uuid not null references public.firms,
 external_ref text not null check(length(trim(external_ref)) between 1 and 160),
 order_ref text not null check(length(trim(order_ref)) between 1 and 128),
 amount_cents integer not null check(amount_cents>0),
 currency text not null default 'USD' check(currency='USD'),
 claim_id uuid unique references public.purchase_claims,
 status text not null default 'reported' check(status in('reported','confirmed','released','reversed')),
 config_version integer references public.economy_config,
 confirmed_at timestamptz,
 release_at timestamptz,
 created_at timestamptz not null default now(),
 unique(firm_id,external_ref)
);
create index commissions_due on public.commissions(release_at,id) where status='confirmed';
create index commissions_config on public.commissions(config_version);
create table public.ledger_entries(
 id bigint generated always as identity primary key,
 wallet_id uuid not null references public.wallet_accounts,
 amount integer not null check(amount<>0),
 bucket text not null check(bucket in('pending','available')),
 type text not null,
 ref_type text not null,
 ref_id uuid not null,
 idempotency_key text not null unique,
 config_version integer not null references public.economy_config,
 created_at timestamptz not null default now(),
 created_by uuid
);
create index ledger_wallet_time on public.ledger_entries(wallet_id,created_at desc,id desc);
create index ledger_source on public.ledger_entries(ref_type,ref_id);
create index ledger_config on public.ledger_entries(config_version);
create trigger ledger_immutable before update or delete on public.ledger_entries for each row execute function private.forbid_mutation();
create table public.xp_events(
 id bigint generated always as identity primary key,
 user_id uuid not null references public.profiles on delete cascade,
 amount integer not null check(amount<>0),source text not null,
 idempotency_key text not null unique, created_at timestamptz not null default now()
);
create index xp_user_time on public.xp_events(user_id,created_at desc);
create table public.levels(
 tier smallint primary key check(tier between 1 and 5),name text not null unique,
 min_xp integer not null check(min_xp>=0), min_purchases integer not null check(min_purchases>=0)
);
insert into public.levels values(1,'Bronze',0,0),(2,'Silver',1000,1),(3,'Gold',4000,3),(4,'Platinum',10000,6),(5,'Black',25000,12);
create table private.founding_members (
 user_id uuid primary key references public.profiles on delete cascade,
 awarded_at timestamptz not null default now(),black_until timestamptz not null
);
alter table private.founding_members enable row level security;
alter table public.wallet_accounts enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.commissions enable row level security;
alter table public.xp_events enable row level security;
alter table public.levels enable row level security;
revoke all on public.wallet_accounts,public.ledger_entries,public.commissions,public.xp_events,public.levels from public,anon,authenticated,service_role;
grant select on public.wallet_accounts,public.ledger_entries,public.commissions,public.xp_events,public.levels to service_role;
grant select on public.wallet_accounts,public.ledger_entries,public.xp_events,public.levels to authenticated;
create policy account_owner on public.wallet_accounts for select to authenticated using(user_id=(select auth.uid()));
create policy ledger_owner on public.ledger_entries for select to authenticated using(exists(select from public.wallet_accounts w where w.id=wallet_id));
create policy xp_owner on public.xp_events for select to authenticated using(user_id=(select auth.uid()));
create policy level_read on public.levels for select to authenticated using(true);
create view public.wallet_balances with(security_invoker=true) as
select w.user_id, coalesce(sum(e.amount) filter(where e.bucket='available'),0)::bigint available,
coalesce(sum(e.amount) filter(where e.bucket='pending'),0)::bigint pending
from public.wallet_accounts w left join public.ledger_entries e on e.wallet_id=w.id group by w.id;
revoke all on public.wallet_balances from public,anon,authenticated;
grant select on public.wallet_balances to authenticated,service_role;

create function private.wallet_for(p_user uuid) returns uuid language plpgsql set search_path='' as $$
declare wallet uuid;
begin
 insert into public.wallet_accounts(user_id) values(p_user) on conflict(user_id) do nothing;
 select id into strict wallet from public.wallet_accounts where user_id=p_user;
 return wallet;
end;
$$;

-- All callers, including retries, must present a finance/owner identity. Only authenticated
-- server actions call this RPC. Match on the firm's order, not on a client-supplied amount.
create function public.finance_record_commission(p_actor uuid,p_firm uuid,p_external text,p_order text,p_cents integer,p_reason text,p_request_id text)
returns uuid language plpgsql security definer set search_path='' as $$
declare existing public.commissions%rowtype; v_id uuid;
begin
 if not exists(select from public.admin_roles where user_id=p_actor and role in('finance','owner'))
 or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'finance permission and reason required' using errcode='42501'; end if;
 insert into public.commissions(firm_id,external_ref,order_ref,amount_cents) values(p_firm,trim(p_external),trim(p_order),p_cents)
 on conflict(firm_id,external_ref) do nothing returning id into v_id;
 if v_id is null then
   select * into strict existing from public.commissions where firm_id=p_firm and external_ref=trim(p_external);
   if existing.amount_cents<>p_cents or upper(existing.order_ref)<>upper(trim(p_order)) then raise exception 'conflicting report'; end if;
   return existing.id;
 end if;
 perform private.write_audit(p_actor,'commission.report','commission',v_id::text,null,jsonb_build_object('amount_cents',p_cents),p_reason,p_request_id);
 return v_id;
end;
$$;

create function public.confirm_commission(p_actor uuid,p_id uuid,p_reason text,p_request_id text,p_cap_reviewed boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 com public.commissions%rowtype; claim public.purchase_claims%rowtype; cfg public.economy_config%rowtype;
 tier integer; buys integer; referrer uuid; wallet uuid; allocation record; season boolean:=false; monthly bigint;
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
 if buys=0 then select referred_by into referrer from public.profiles where id=claim.user_id; end if;
 select * into allocation from private.coin_split(com.amount_cents,case when season then cfg.founding_share_bps else cfg.level_share_bps[tier] end,
   0,season,case when referrer is null then 0 else cfg.referral_bps end,0,cfg.max_total_giveback_bps);
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

create function public.release_pending_coins(p_limit integer default 100) returns integer
language plpgsql security definer set search_path='' as $$
declare com public.commissions%rowtype; released integer:=0;
begin
 for com in select c.* from public.commissions c join public.firms f on f.id=c.firm_id
  where c.status='confirmed' and c.release_at<=now() and f.status='active'
  order by c.release_at,c.id limit least(500,greatest(0,p_limit)) for update of c skip locked loop
   insert into public.ledger_entries(wallet_id,amount,bucket,type,ref_type,ref_id,idempotency_key,config_version)
   select e.wallet_id,e.amount*movement.sign,movement.bucket,'release','commission',com.id,e.idempotency_key||':'||movement.bucket,e.config_version
   from public.ledger_entries e cross join (values(-1,'pending'),(1,'available')) movement(sign,bucket)
   where e.ref_type='commission' and e.ref_id=com.id and e.type in('purchase','referral');
   update public.commissions set status='released' where id=com.id;
   update public.purchase_claims set status='released' where id=com.claim_id;
   released:=released+1;
 end loop;
 return released;
end;
$$;
create function public.reverse_commission(p_actor uuid,p_id uuid,p_reason text,p_request_id text) returns void
language plpgsql security definer set search_path='' as $$
declare com public.commissions%rowtype;
begin
 if not exists(select from public.admin_roles where user_id=p_actor and role in('finance','owner'))
 or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'finance permission and reason required' using errcode='42501'; end if;
 select * into strict com from public.commissions where id=p_id for update;
 if com.status='reversed' then return; end if;
 insert into public.ledger_entries(wallet_id,amount,bucket,type,ref_type,ref_id,idempotency_key,config_version,created_by)
 select wallet_id,-sum(amount)::int,bucket,'clawback','commission',p_id,'reverse:'||p_id||':'||wallet_id||':'||bucket,com.config_version,p_actor
 from public.ledger_entries where ref_type='commission' and ref_id=p_id group by wallet_id,bucket having sum(amount)<>0;
 update public.commissions set status='reversed' where id=p_id;
 update public.purchase_claims set status='reversed' where id=com.claim_id;
 perform private.write_audit(p_actor,'commission.reverse','commission',p_id::text,null,null,p_reason,p_request_id);
end;
$$;
revoke execute on function private.coin_split(integer,integer,integer,boolean,integer,integer,integer),
 private.wallet_for(uuid),public.finance_record_commission(uuid,uuid,text,text,integer,text,text),
 public.confirm_commission(uuid,uuid,text,text,boolean),public.reverse_commission(uuid,uuid,text,text),
 public.release_pending_coins(integer) from public,anon,authenticated;
grant execute on function public.finance_record_commission(uuid,uuid,text,text,integer,text,text),
 public.confirm_commission(uuid,uuid,text,text,boolean),public.reverse_commission(uuid,uuid,text,text),
 public.release_pending_coins(integer) to service_role;

-- pg_cron calls this wrapper so a failed release leaves a visible job record.
create function private.run_release_job() returns void language plpgsql security definer set search_path='' as $$
declare run uuid;
begin
 insert into public.job_runs(name) values('release_pending_coins') returning id into run;
 begin
   perform public.release_pending_coins(500);
   update public.job_runs set finished_at=clock_timestamp(),status='success' where id=run;
 exception when others then
   update public.job_runs set finished_at=clock_timestamp(),status='failed',error_code=sqlstate where id=run;
 end;
end;
$$;
revoke execute on function private.run_release_job() from public,anon,authenticated;
do $$
begin
 if exists(select from pg_available_extensions where name='pg_cron') then
   create extension if not exists pg_cron;
   perform cron.schedule('fundback-release-coins','*/15 * * * *','select private.run_release_job()');
 end if;
end $$;
