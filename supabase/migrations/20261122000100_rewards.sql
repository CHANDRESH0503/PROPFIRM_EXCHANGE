create table public.rewards(
 id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 1 and 120),
 description text not null, instructions text not null,kind text not null check(kind in('free_challenge_voucher','discount_voucher','booster')),
 program_id uuid references public.firm_programs,cost_coins integer not null check(cost_coins>0),
 per_user_limit integer check(per_user_limit>0),min_tier smallint not null default 1 references public.levels,
 countries text[] not null default '{}',low_stock integer not null default 5 check(low_stock>=0),
 starts_at timestamptz,ends_at timestamptz,active boolean not null default false,
 revision integer not null default 1,check(ends_at is null or starts_at is null or ends_at>starts_at),
 check(kind='booster' or program_id is not null)
);
create index rewards_program on public.rewards(program_id);
create index rewards_tier on public.rewards(min_tier);
create table public.redemptions(
 id uuid primary key default gen_random_uuid(),wallet_id uuid not null references public.wallet_accounts,
 reward_id uuid not null references public.rewards,request_id uuid not null,cost_coins integer not null,
 reward_name text not null,instructions text not null,status text not null check(status in('pending','fulfilled','cancelled')),
 created_at timestamptz not null default now(),target_at timestamptz not null default now()+interval '48 hours',
 fulfilled_at timestamptz,staff_note text,unique(wallet_id,request_id)
);
create index redemption_queue on public.redemptions(status,target_at);
create index redemption_reward on public.redemptions(reward_id,created_at,id);
create table public.voucher_inventory(
 id uuid primary key default gen_random_uuid(),reward_id uuid not null references public.rewards,
 ciphertext text not null,code_hash text not null unique check(code_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz,redemption_id uuid unique references public.redemptions,created_at timestamptz not null default now()
);
create index voucher_available on public.voucher_inventory(reward_id,expires_at,id) where redemption_id is null;
create table public.reward_goals(user_id uuid primary key references public.profiles on delete cascade,
 reward_id uuid not null references public.rewards);
create index reward_goals_reward on public.reward_goals(reward_id);
alter table public.rewards enable row level security;
alter table public.redemptions enable row level security;
alter table public.voucher_inventory enable row level security;
alter table public.reward_goals enable row level security;
revoke all on public.rewards,public.redemptions,public.voucher_inventory,public.reward_goals from public,anon,authenticated,service_role;
grant select on public.rewards,public.redemptions,public.voucher_inventory,public.reward_goals to service_role;
grant select on public.redemptions,public.reward_goals to authenticated;
create policy redemption_own on public.redemptions for select to authenticated using(exists(select from public.wallet_accounts a where a.id=wallet_id));
create policy goal_own on public.reward_goals for select to authenticated using(user_id=(select auth.uid()));

create function public.member_rewards(p_user uuid,p_ip_country text) returns table(
 id uuid,name text,description text,kind text,cost_coins integer,min_tier smallint,per_user_limit integer,stock integer,eligible boolean,
 firm_name text,account_size integer,is_goal boolean
) language sql stable security definer set search_path='' as $$
 select r.id,r.name,r.description,r.kind,r.cost_coins,r.min_tier,r.per_user_limit,
 case when r.kind='booster' then null else (select count(*)::int from public.voucher_inventory v where v.reward_id=r.id and v.redemption_id is null and (v.expires_at is null or v.expires_at>now())) end,
 r.min_tier<=progress.tier and (r.per_user_limit is null or r.per_user_limit>(select count(*) from public.redemptions d join public.wallet_accounts a on a.id=d.wallet_id
 where a.user_id=p_user and d.reward_id=r.id and d.status<>'cancelled')), f.name,p.account_size,exists(select from public.reward_goals g where g.user_id=p_user and g.reward_id=r.id)
 from public.rewards r cross join public.trader_progress(p_user) progress join public.profiles u on u.id=p_user
 left join public.firm_programs p on p.id=r.program_id left join public.firms f on f.id=p.firm_id
 where u.onboarded_at is not null and r.active and (r.starts_at is null or r.starts_at<=now()) and (r.ends_at is null or r.ends_at>now())
 and (r.program_id is null or (not f.is_sample and f.status='active' and p.published_at<=now() and f.published_at<=now()))
 and (cardinality(r.countries)=0 or (u.country_code=any(r.countries) and (p_ip_country is null or p_ip_country=any(r.countries))))
 and not exists(select from public.geo_rules g where g.country_code in(u.country_code,p_ip_country) and g.asset_class=any(f.asset_classes));
$$;
create function public.set_reward_goal(p_user uuid,p_reward uuid,p_ip_country text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select from public.member_rewards(p_user,p_ip_country) where id=p_reward) then raise exception 'unavailable';end if;
 insert into public.reward_goals values(p_user,p_reward) on conflict(user_id) do update set reward_id=excluded.reward_id;
end;
$$;
create function private.fulfill_reward_queue(p_reward uuid) returns void language plpgsql set search_path='' as $$
declare d public.redemptions%rowtype; v uuid;
begin
 for d in select * from public.redemptions where reward_id=p_reward and status='pending' order by created_at,id for update loop
  select id into v from public.voucher_inventory where reward_id=p_reward and redemption_id is null and (expires_at is null or expires_at>now())
  order by expires_at nulls last,created_at,id limit 1 for update;
  exit when not found;
  update public.voucher_inventory set redemption_id=d.id where id=v;
  update public.redemptions set fulfilled_at=now(),status='fulfilled' where id=d.id;
 end loop;
end;
$$;

create function public.redeem_reward(p_user uuid,p_reward uuid,p_request uuid,p_expected_cost integer,p_ip_country text)
returns uuid language plpgsql security definer set search_path='' as $$
declare w uuid;r public.rewards%rowtype;prior public.redemptions%rowtype;bal bigint;cv integer;v_id uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 w:=private.wallet_for(p_user);
 select * into prior from public.redemptions where wallet_id=w and request_id=p_request;
 if found then
   if prior.reward_id<>p_reward or prior.cost_coins<>p_expected_cost then raise exception 'request conflict';end if;
   return prior.id;
 end if;
 select * into strict r from public.rewards where id=p_reward for update;
 if not exists(select from public.member_rewards(p_user,p_ip_country) where id=p_reward and eligible)
 or r.cost_coins<>p_expected_cost then raise exception 'reward changed'; end if;
 select available into bal from public.wallet_balances where user_id=p_user;
 if bal<r.cost_coins then raise exception 'insufficient coins';end if;
 if r.kind='booster' and exists(select from public.user_boosters where user_id=p_user and kind='giveback' and value>=500) then raise exception 'booster already held';end if;
 select version into strict cv from public.economy_config where effective_at<=now() order by effective_at desc limit 1;
 insert into public.redemptions(wallet_id,reward_id,request_id,cost_coins,reward_name,instructions,status)
 values(w,p_reward,p_request,r.cost_coins,r.name,r.instructions,'pending') returning id into v_id;
 insert into public.ledger_entries(wallet_id,amount,bucket,type,ref_type,ref_id,idempotency_key,config_version)
 values(w,-r.cost_coins,'available','redemption','redemption',v_id,'redeem:'||v_id,cv);
 if r.kind='booster' then
  insert into public.user_boosters(user_id,kind,value) values(p_user,'giveback',500) on conflict(user_id,kind) do update set value=excluded.value;
  update public.redemptions set status='fulfilled',fulfilled_at=now() where id=v_id;
 else perform private.fulfill_reward_queue(p_reward);end if;
 return v_id;
end;
$$;

create function public.admin_save_reward(p_actor uuid,p_id uuid,p_revision integer,p_values jsonb,p_reason text,p_request_id text)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.rewards%rowtype;prev public.rewards%rowtype;
begin
 if not exists(select from public.admin_roles where user_id=p_actor and role in('owner','finance')) or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'permission required' using errcode='42501';end if;
 if p_id is not null then
  select * into strict prev from public.rewards where id=p_id for update;
  if prev.revision<>p_revision then raise exception 'stale reward' using errcode='40001';end if;
 end if;
 r:=jsonb_populate_record(null::public.rewards,p_values);
 r.id:=coalesce(p_id,gen_random_uuid());
 if p_id is null then
   insert into public.rewards(id,name,description,instructions,kind,program_id,cost_coins,per_user_limit,min_tier,countries,low_stock,starts_at,ends_at,active)
   values(r.id,r.name,r.description,r.instructions,r.kind,r.program_id,r.cost_coins,r.per_user_limit,r.min_tier,r.countries,r.low_stock,r.starts_at,r.ends_at,r.active);
 else
   if prev.kind<>r.kind or prev.program_id is distinct from r.program_id then raise exception 'reward identity cannot change';end if;
   update public.rewards set name=r.name,description=r.description,instructions=r.instructions,cost_coins=r.cost_coins,per_user_limit=r.per_user_limit,
   min_tier=r.min_tier,countries=r.countries,low_stock=r.low_stock,starts_at=r.starts_at,ends_at=r.ends_at,active=r.active,revision=revision+1 where id=r.id;
 end if;
 perform private.write_audit(p_actor,'reward.save','reward',r.id::text,to_jsonb(prev),p_values,p_reason,p_request_id);return r.id;
end;
$$;
create function public.stock_vouchers(p_actor uuid,p_reward uuid,p_codes jsonb,p_expiry timestamptz,p_reason text,p_request_id text)
returns integer language plpgsql security definer set search_path='' as $$
declare inserted integer;
begin
 if not exists(select from public.admin_roles where user_id=p_actor and role in('owner','finance')) or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'permission required' using errcode='42501';end if;
 perform 1 from public.rewards where id=p_reward and kind<>'booster' for update;
 if not found or jsonb_array_length(p_codes) not between 1 and 500 or p_expiry<=now() then raise exception 'invalid stock';end if;
 insert into public.voucher_inventory(reward_id,ciphertext,code_hash,expires_at)
 select p_reward,v->>'ciphertext',v->>'hash',p_expiry from jsonb_array_elements(p_codes) v on conflict(code_hash) do nothing;
 get diagnostics inserted=row_count;
 perform private.fulfill_reward_queue(p_reward);
 perform private.write_audit(p_actor,'reward.stock','reward',p_reward::text,null,jsonb_build_object('inserted',inserted),p_reason,p_request_id);return inserted;
end;
$$;
create function public.cancel_redemption(p_actor uuid,p_id uuid,p_reason text,p_request_id text)
returns void language plpgsql security definer set search_path='' as $$
declare d public.redemptions%rowtype;cv integer;
begin
 if not exists(select from public.admin_roles where user_id=p_actor and role in('owner','finance','support')) or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'permission required' using errcode='42501';end if;
 select * into strict d from public.redemptions where id=p_id for update;
 if d.status='cancelled' then return;end if;
 if d.status<>'pending' then raise exception 'already fulfilled';end if;
 select config_version into strict cv from public.ledger_entries where idempotency_key='redeem:'||p_id;
 insert into public.ledger_entries(wallet_id,amount,bucket,type,ref_type,ref_id,idempotency_key,config_version,created_by)
 values(d.wallet_id,d.cost_coins,'available','refund','redemption',p_id,'refund:'||p_id,cv,p_actor);
 update public.redemptions set status='cancelled',staff_note=p_reason where id=p_id;
 perform private.write_audit(p_actor,'reward.cancel','redemption',p_id::text,null,null,p_reason,p_request_id);
end;
$$;
revoke execute on function public.member_rewards(uuid,text),public.redeem_reward(uuid,uuid,uuid,integer,text),public.set_reward_goal(uuid,uuid,text),
 private.fulfill_reward_queue(uuid),public.admin_save_reward(uuid,uuid,integer,jsonb,text,text),public.stock_vouchers(uuid,uuid,jsonb,timestamptz,text,text),
 public.cancel_redemption(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.member_rewards(uuid,text),public.redeem_reward(uuid,uuid,uuid,integer,text),public.set_reward_goal(uuid,uuid,text),
 public.admin_save_reward(uuid,uuid,integer,jsonb,text,text),public.stock_vouchers(uuid,uuid,jsonb,timestamptz,text,text),
 public.cancel_redemption(uuid,uuid,text,text) to service_role;
