-- Public editorial data and private affiliate agreements have separate grants.
create table public.firms (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=80),
  name text not null check (length(trim(name)) between 1 and 120),
  description text not null default '',
  asset_classes public.asset_class[] not null check (cardinality(asset_classes)>0 and array_position(asset_classes,null) is null),
  platforms text[] not null default '{}',
  status text not null default 'active' check (status in ('active','watch','delisted')),
  status_note text not null default '',
  logo_url text check (logo_url ~ '^https://'),
  is_sample boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.firm_agreements (
  firm_id uuid primary key references public.firms on delete cascade,
  tracking_url text check (tracking_url ~ '^https://'),
  promo_code text,
  commission_bps integer not null default 0 check (commission_bps between 0 and 10000),
  rebate_permission boolean not null default false,
  evidence_url text check (evidence_url ~ '^https://'),
  check (not rebate_permission or evidence_url is not null)
);
create table public.firm_programs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms,
  name text not null check (length(trim(name)) between 1 and 120),
  account_size integer not null check (account_size>0),
  steps smallint not null check (steps between 0 and 8),
  list_price_cents integer not null check (list_price_cents>=0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  profit_target_bps integer check(profit_target_bps between 0 and 10000),
  daily_loss_bps integer check(daily_loss_bps between 0 and 10000),
  max_loss_bps integer check(max_loss_bps between 0 and 10000),
  profit_split_bps integer check(profit_split_bps between 0 and 10000),
  drawdown_type text not null check(drawdown_type in ('static','trailing','end_of_day')),
  payout_frequency text not null,
  rules jsonb not null default '{}' check(jsonb_typeof(rules)='object'),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (firm_id,id)
);
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms,
  title text not null check(length(trim(title)) between 1 and 160),
  terms text not null,
  code text not null check(length(trim(code)) between 1 and 64),
  discount_bps integer not null check(discount_bps between 0 and 10000),
  exclusive boolean not null default false,
  starts_at timestamptz not null,
  ends_at timestamptz not null check(ends_at>starts_at),
  published boolean not null default false,
  unique(firm_id,id)
);
create table public.offer_programs (
  firm_id uuid not null,
  offer_id uuid not null,
  program_id uuid not null,
  primary key(offer_id,program_id),
  foreign key(firm_id,offer_id) references public.offers(firm_id,id) on delete cascade,
  foreign key(firm_id,program_id) references public.firm_programs(firm_id,id)
);
create index offer_programs_program on public.offer_programs(program_id);
create index offers_schedule on public.offers(starts_at,ends_at) where published;
create table public.price_history (
  id bigint generated always as identity primary key,
  program_id uuid not null references public.firm_programs,
  list_price_cents integer not null,
  currency text not null,
  recorded_at timestamptz not null default now()
);
create index price_history_program_time on public.price_history(program_id,recorded_at desc);
create table public.firm_changes (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms,
  summary text not null check(length(trim(summary)) between 1 and 2000),
  source_url text not null check(source_url ~ '^https://'),
  published_at timestamptz not null
);
create index firm_changes_firm_time on public.firm_changes(firm_id,published_at desc);

create function private.record_program_price() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.price_history(program_id,list_price_cents,currency)
  values(new.id,new.list_price_cents,new.currency);
  return new;
end;
$$;
revoke execute on function private.record_program_price() from public,anon,authenticated;
create trigger program_initial_price after insert on public.firm_programs for each row execute function private.record_program_price();
create trigger program_price_change after update on public.firm_programs for each row
when ((old.list_price_cents,old.currency) is distinct from (new.list_price_cents,new.currency))
execute function private.record_program_price();

alter table public.firms enable row level security;
alter table public.firm_agreements enable row level security;
alter table public.firm_programs enable row level security;
alter table public.offers enable row level security;
alter table public.offer_programs enable row level security;
alter table public.price_history enable row level security;
alter table public.firm_changes enable row level security;
revoke all on public.firms,public.firm_agreements,public.firm_programs,public.offers,public.offer_programs,
  public.price_history,public.firm_changes from public,anon,authenticated;
grant all on public.firms,public.firm_agreements,public.firm_programs,public.offers,public.offer_programs,
  public.price_history,public.firm_changes to service_role;
grant select on public.firms,public.firm_programs,public.price_history,public.firm_changes to anon,authenticated;
-- Offers and agreements are read only through the app after server-side geo filtering.
create policy published_firms on public.firms for select to anon,authenticated using (published_at <= now());
create policy published_programs on public.firm_programs for select to anon,authenticated
  using (published_at <= now() and exists(select from public.firms f where f.id=firm_id));
create policy published_prices on public.price_history for select to anon,authenticated
  using (exists(select from public.firm_programs p where p.id=program_id));
create policy published_changes on public.firm_changes for select to anon,authenticated
  using (published_at <= now() and exists(select from public.firms f where f.id=firm_id));

-- Preview estimates use the current base level until an authenticated level or season
-- override is available. Config versions are insert-only so future credits can cite one.
create table public.economy_config (
  version integer generated always as identity primary key,
  effective_at timestamptz not null unique,
  level_share_bps integer[] not null check(cardinality(level_share_bps)=5 and array_position(level_share_bps,null) is null
    and 0 <= all(level_share_bps) and 10000 >= all(level_share_bps)),
  founding_share_bps integer not null check(founding_share_bps between 0 and 10000),
  max_total_giveback_bps integer not null check(max_total_giveback_bps between 0 and 10000),
  referral_bps integer not null check(referral_bps between 0 and 10000),
  hold_days integer not null check(hold_days>=0)
);
insert into public.economy_config(effective_at, level_share_bps, founding_share_bps, max_total_giveback_bps,referral_bps,hold_days)
values ('2026-01-01T00:00:00Z','{6000,6400,6800,7200,7500}',9000,9500,1000,14);
alter table public.economy_config enable row level security;
revoke all on public.economy_config from public,anon,authenticated;
grant select,insert on public.economy_config to service_role;
create trigger economy_config_immutable before update or delete on public.economy_config
for each row execute function private.forbid_mutation();

-- Only the server supplies countries, using both the verified profile and Cloudflare.
-- Discount precedence is deterministic for overlapping offers and ends are exclusive.
create function public.catalogue_programs(p_profile_country text,p_ip_country text)
returns table (
  program_id uuid,firm_id uuid,slug text,firm_name text, description text,asset_classes public.asset_class[],platforms text[],
  firm_status text,status_note text,is_sample boolean,program_name text,account_size integer,steps smallint,
  list_price_cents integer,currency text,profit_target_bps integer,daily_loss_bps integer,max_loss_bps integer,
  drawdown_type text,profit_split_bps integer,payout_frequency text,rules jsonb,created_at timestamptz,
  offer_id uuid,offer_title text,offer_terms text,offer_code text,discount_bps integer,ends_at timestamptz,
  rebate_permission boolean,checkout_cents integer,estimated_coins integer,net_cents integer
)
language sql stable security definer set search_path='' as $$
  select p.id,f.id,f.slug,f.name,f.description,f.asset_classes,f.platforms,f.status,f.status_note,f.is_sample,
    p.name,p.account_size,p.steps,p.list_price_cents,p.currency,p.profit_target_bps,p.daily_loss_bps,p.max_loss_bps,
    p.drawdown_type,p.profit_split_bps,p.payout_frequency,p.rules,p.created_at,
    o.id,o.title,o.terms,o.code,o.discount_bps,o.ends_at,coalesce(a.rebate_permission,false), price.cents,coins.amount,
    price.cents-coins.amount
  from public.firm_programs p join public.firms f on f.id=p.firm_id
  left join public.firm_agreements a on a.firm_id=f.id
  left join lateral (
    select offer.* from public.offers offer join public.offer_programs op on op.offer_id=offer.id
    where op.program_id=p.id and offer.published and f.status<>'delisted' and offer.starts_at<=now() and offer.ends_at>now()
    order by offer.discount_bps desc,offer.ends_at,offer.id limit 1
  ) o on true
  cross join lateral (select (p.list_price_cents::bigint - p.list_price_cents::bigint*coalesce(o.discount_bps,0)/10000)::integer as cents) price
  cross join lateral (
    select case when a.rebate_permission and p.currency='USD' and f.status='active' then
      (price.cents::bigint*a.commission_bps/10000*
        (select least(c.level_share_bps[1],c.max_total_giveback_bps) from public.economy_config c
          where c.effective_at<=now() order by c.effective_at desc limit 1)/10000)::integer else 0 end as amount
  ) coins
  where p.published_at<=now() and f.published_at<=now()
    and not exists(select from public.geo_rules g where g.country_code in(p_profile_country,p_ip_country)
      and g.action='block' and g.asset_class=any(f.asset_classes));
$$;
revoke execute on function public.catalogue_programs(text,text) from public,anon,authenticated;
grant execute on function public.catalogue_programs(text,text) to service_role;
