create table public.commission_import_batches(
 id uuid primary key default gen_random_uuid(),firm_id uuid not null references public.firms,
 actor_id uuid references public.profiles on delete set null,
 fingerprint text not null, mapping jsonb not null,
 row_count integer not null check(row_count between 1 and 500), created_at timestamptz not null default now(),
 unique(firm_id,fingerprint)
);
create index commission_import_actor on public.commission_import_batches(actor_id);
alter table public.commission_import_batches enable row level security;
revoke all on public.commission_import_batches from public,anon,authenticated,service_role;
grant select on public.commission_import_batches to service_role;

create function public.import_commissions(p_actor uuid,p_firm uuid,p_fingerprint text,p_mapping jsonb,p_rows jsonb,p_reason text,p_request_id text)
returns uuid language plpgsql security definer set search_path='' as $$
declare row_data jsonb; batch uuid;
begin
 if not exists(select from public.admin_roles where user_id=p_actor and role in('owner','finance'))
 or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'finance access required' using errcode='42501'; end if;
 if p_fingerprint !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 500 then
  raise exception 'invalid report'; end if;
 insert into public.commission_import_batches(firm_id,actor_id,fingerprint,mapping,row_count)
 values(p_firm,p_actor,p_fingerprint,p_mapping,jsonb_array_length(p_rows)) on conflict(firm_id,fingerprint) do nothing returning id into batch;
 if batch is null then select id into strict batch from public.commission_import_batches where firm_id=p_firm and fingerprint=p_fingerprint; return batch; end if;
 for row_data in select value from jsonb_array_elements(p_rows) loop
  perform public.finance_record_commission(p_actor,p_firm,row_data->>'external',row_data->>'order',(row_data->>'cents')::integer,p_reason,p_request_id);
 end loop;
 perform private.write_audit(p_actor,'commission.import','import_batch',batch::text,null,jsonb_build_object('rows',jsonb_array_length(p_rows)),p_reason,p_request_id);
 return batch;
end;
$$;

-- Read-only snapshots for the finance queue. Matching is deterministic. A reviewer confirms
-- the partner report before any pending credit is recorded.
create view public.commission_matches with(security_invoker=true) as
select c.id,c.firm_id,f.name firm_name,c.external_ref,c.order_ref,c.amount_cents,c.status,c.created_at,c.release_at,
 p.id candidate_id,p.status claim_status,
 case when p.id is null then 0 when p.click_id is null then 80 else 100 end confidence
from public.commissions c join public.firms f on f.id=c.firm_id
left join public.purchase_claims p on p.firm_id=c.firm_id and upper(trim(p.order_ref))=upper(trim(c.order_ref));
create view public.finance_totals with(security_invoker=true) as
with backing as(select coalesce(sum(amount_cents) filter(where status in('confirmed','released')),0) confirmed_cents,
 coalesce(sum(amount_cents) filter(where status='reported'),0) reported_cents from public.commissions),
balances as(select coalesce(sum(greatest(available,0)),0) available,coalesce(sum(greatest(pending,0)),0) pending from public.wallet_balances)
select reported_cents,confirmed_cents,available,pending,(pending+available)/nullif(confirmed_cents,0) liability_ratio from backing,balances;
revoke all on public.finance_totals,public.commission_matches from public,anon,authenticated,service_role;
grant select on public.finance_totals,public.commission_matches to service_role;
revoke execute on function public.import_commissions(uuid,uuid,text,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.import_commissions(uuid,uuid,text,jsonb,jsonb,text,text) to service_role;
