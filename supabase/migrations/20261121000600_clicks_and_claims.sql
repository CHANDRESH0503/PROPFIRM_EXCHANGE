create table public.clicks (
  click_id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete set null,
  firm_id uuid not null references public.firms,
  program_id uuid not null references public.firm_programs,
  offer_id uuid references public.offers,
  source text not null,
  country_code char(2) not null,
  checkout_cents integer not null,
  currency text not null,
  created_at timestamptz not null default now()
);
create index clicks_user_time on public.clicks(user_id,created_at desc);
create index clicks_program_time on public.clicks(program_id,created_at desc);
create index clicks_firm_time on public.clicks(firm_id,created_at desc);
create index clicks_offer on public.clicks(offer_id);

create function public.record_outbound(p_user uuid,p_program uuid,p_ip_country text,p_declared_country text,p_source text)
returns table(click_id uuid,tracking_url text)
language plpgsql security definer set search_path='' as $$
declare
  profile_country text;
  selected record;
  recorded uuid;
begin
  if p_user is not null then
    select country_code into profile_country from public.profiles where id=p_user and onboarded_at is not null;
    if profile_country is null then raise exception 'onboarding_required' using errcode='42501'; end if;
  end if;
  profile_country:=coalesce(profile_country,p_declared_country);
  if coalesce(profile_country,p_ip_country,'') !~ '^[A-Z]{2}$' then raise exception 'country_required'; end if;
  select c.*,a.tracking_url into selected from public.catalogue_programs(profile_country,p_ip_country) c
  join public.firm_agreements a on a.firm_id=c.firm_id
  where c.program_id=p_program and not c.is_sample and c.firm_status='active' and a.tracking_url is not null;
  if not found then raise exception 'unavailable' using errcode='42501'; end if;
  insert into public.clicks(user_id,firm_id,program_id,offer_id,source,country_code,checkout_cents,currency)
  values(p_user,selected.firm_id,p_program,selected.offer_id,left(p_source,64),coalesce(profile_country,p_ip_country),
    selected.checkout_cents,selected.currency) returning clicks.click_id into recorded;
  return query select recorded,selected.tracking_url::text;
end;
$$;

create table public.purchase_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete set null,
  program_id uuid not null references public.firm_programs,
  firm_id uuid not null references public.firms,
  click_id uuid references public.clicks,
  order_ref text not null check(length(trim(order_ref)) between 1 and 128),
  amount_paid_cents integer not null check(amount_paid_cents>0),
  currency text not null,
  expected_cents integer not null,
  purchased_on date not null,
  checkout_email text check(checkout_email=lower(trim(checkout_email)) and length(checkout_email)<=254),
  receipt_path text unique,
  receipt_hash text unique check(receipt_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'submitted' check(status in ('submitted','needs_info','flagged','approved','rejected','matched','confirmed','released','reversed')),
  review_note text,
  reviewed_by uuid references public.profiles on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index claims_order_once on public.purchase_claims(firm_id,upper(trim(order_ref)));
create index claims_user_time on public.purchase_claims(user_id,created_at desc);
create index claims_queue on public.purchase_claims(status,created_at,id);
create index claims_program on public.purchase_claims(program_id);
create index claims_click on public.purchase_claims(click_id);
create index claims_reviewer on public.purchase_claims(reviewed_by);
alter table public.clicks enable row level security;
alter table public.purchase_claims enable row level security;
revoke all on public.clicks,public.purchase_claims from public,anon,authenticated;
grant all on public.clicks,public.purchase_claims to service_role;
grant select on public.purchase_claims to authenticated;
create policy claims_own on public.purchase_claims for select to authenticated using(user_id=(select auth.uid()));

create function public.submit_claim(p_id uuid,p_user uuid,p_program uuid,p_ip_country text,p_order_ref text,p_amount integer,
 p_purchased_on date,p_email text,p_path text,p_hash text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  country text;
  program record;
  clicked public.clicks%rowtype;
begin
  select country_code into country from public.profiles where id=p_user and onboarded_at is not null;
  if country is null then raise exception 'onboarding required' using errcode='42501'; end if;
  select * into program from public.catalogue_programs(country,p_ip_country) where program_id=p_program;
  if not found or program.is_sample or not program.rebate_permission then raise exception 'ineligible' using errcode='42501'; end if;
  if p_purchased_on>(now() at time zone 'UTC')::date or p_path !~ ('^'||p_user::text||'/'||p_id::text||'\.(pdf|png|jpg)$') then
    raise exception 'invalid proof';
  end if;
  select * into clicked from public.clicks where user_id=p_user and program_id=p_program
    and created_at<(p_purchased_on+1)::timestamp at time zone 'UTC' order by created_at desc limit 1;
  insert into public.purchase_claims(id,user_id,program_id,firm_id,click_id,order_ref,amount_paid_cents,currency,expected_cents,
    purchased_on,checkout_email,receipt_path,receipt_hash)
  values(p_id,p_user,p_program,program.firm_id,clicked.click_id,trim(p_order_ref),p_amount,program.currency,
    coalesce(clicked.checkout_cents,program.checkout_cents),p_purchased_on,lower(trim(p_email)),p_path,p_hash);
  return p_id;
end;
$$;

revoke execute on function public.record_outbound(uuid,uuid,text,text,text),public.submit_claim(uuid,uuid,uuid,text,text,integer,date,text,text,text)
 from public,anon,authenticated;
grant execute on function public.record_outbound(uuid,uuid,text,text,text),public.submit_claim(uuid,uuid,uuid,text,text,integer,date,text,text,text)
 to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('receipts','receipts',false,4194304,array['image/jpeg','image/png','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create function public.review_claim(p_actor uuid,p_id uuid,p_status text,p_reason text,p_request_id text)
returns void language plpgsql security definer set search_path='' as $$
declare old_status text;
begin
  if not exists(select from public.admin_roles where user_id=p_actor and role in('owner','finance','support')) then
    raise exception 'review role required' using errcode='42501';
  end if;
  if p_status not in ('needs_info','flagged','approved','rejected') or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then
    raise exception 'invalid decision';
  end if;
  select status into old_status from public.purchase_claims where id=p_id for update;
  if not found or old_status not in('submitted','needs_info','flagged') or p_status=old_status then raise exception 'stale decision' using errcode='40001'; end if;
  update public.purchase_claims set status=p_status,review_note=p_reason,reviewed_by=p_actor,reviewed_at=now() where id=p_id;
  perform private.write_audit(p_actor,'claim.review','claim',p_id::text,jsonb_build_object('status',old_status),
    jsonb_build_object('status',p_status),p_reason,p_request_id);
end;
$$;
revoke execute on function public.review_claim(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.review_claim(uuid,uuid,text,text,text) to service_role;
