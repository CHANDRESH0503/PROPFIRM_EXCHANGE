-- The finance review list shows whether each confirmed commission has been paid by the firm.
-- Columns are appended so existing readers are unaffected.
create or replace view public.commission_matches with (security_invoker = true) as
select c.id, c.firm_id, f.name firm_name, c.external_ref, c.order_ref, c.amount_cents, c.status,
       c.created_at, c.release_at,
       p.id candidate_id, p.status claim_status,
       case when p.id is null then 0 when p.click_id is null then 80 else 100 end confidence,
       c.paid_at, c.paid_reference
from public.commissions c
join public.firms f on f.id = c.firm_id
left join public.purchase_claims p
  on p.firm_id = c.firm_id and upper(trim(p.order_ref)) = upper(trim(c.order_ref));

revoke all on public.commission_matches from public, anon, authenticated, service_role;
grant select on public.commission_matches to service_role;
