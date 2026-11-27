-- Commission payments and reconciliation (09-admin.md §8).
--
-- "Paid" records that the firm actually paid us for a commission. It is independent of the
-- member side (confirmed → released): Coins are backed by the confirmed commission, and paid
-- tells finance which confirmed money has arrived. A commission can be marked paid once, by
-- finance staff, with a payout reference and a reason; the change is audited.

alter table public.commissions
  add column paid_at timestamptz,
  add column paid_reference text check (paid_reference is null or length(trim(paid_reference)) between 1 and 160),
  add column paid_by uuid references auth.users on delete set null,
  add constraint commissions_paid_after_confirm check (paid_at is null or confirmed_at is not null);

create index commissions_unpaid on public.commissions (confirmed_at)
  where paid_at is null and status in ('confirmed', 'released');

/*
 * Marks confirmed or released commissions as paid. Commissions that are already paid, reversed
 * or still unconfirmed are left unchanged, so a retried request is harmless. Returns the number
 * of commissions newly marked paid.
 */
create function public.mark_commissions_paid(
  p_actor uuid,
  p_ids uuid[],
  p_reference text,
  p_paid_on date,
  p_reason text,
  p_request_id text
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  marked uuid[];
begin
  if not exists (select from public.admin_roles where user_id = p_actor and role in ('finance', 'owner'))
     or length(trim(coalesce(p_reason, ''))) not between 3 and 1000
     or length(trim(coalesce(p_reference, ''))) not between 1 and 160 then
    raise exception 'finance permission, reference and reason required' using errcode = '42501';
  end if;
  if p_paid_on is null or p_paid_on > (now() at time zone 'UTC')::date
     or coalesce(cardinality(p_ids), 0) not between 1 and 500 then
    raise exception 'paid date and 1 to 500 commissions required' using errcode = '22023';
  end if;

  with updated as (
    update public.commissions c
    set paid_at = (p_paid_on::timestamp at time zone 'UTC'),
        paid_reference = trim(p_reference),
        paid_by = p_actor
    where c.id = any (p_ids)
      and c.paid_at is null
      and c.status in ('confirmed', 'released')
    returning c.id
  )
  select coalesce(array_agg(id), '{}') into marked from updated;

  if cardinality(marked) > 0 then
    perform private.write_audit(
      p_actor, 'commission.mark_paid', 'commission', null, null,
      jsonb_build_object('ids', marked, 'reference', trim(p_reference), 'paid_on', p_paid_on),
      p_reason, p_request_id
    );
  end if;
  return cardinality(marked);
end;
$$;

/*
 * Reconciliation: what the two sides disagree on.
 *  - claim_without_commission: an approved claim with no commission matched after 7 days.
 *  - commission_without_claim: a reported commission that matches no claim.
 *  - unpaid: a confirmed commission the firm has not paid 45 days after confirmation.
 */
create view public.commission_reconciliation with (security_invoker = true) as
select 'claim_without_commission'::text as issue,
       c.firm_id, f.name as firm_name, c.order_ref, c.amount_paid_cents as amount_cents,
       c.id as claim_id, null::uuid as commission_id, c.reviewed_at as since
from public.purchase_claims c
join public.firms f on f.id = c.firm_id
where c.status = 'approved'
  and c.reviewed_at < now() - interval '7 days'
  and not exists (select 1 from public.commissions m where m.claim_id = c.id)
union all
select 'commission_without_claim', m.firm_id, f.name, m.order_ref, m.amount_cents,
       null, m.id, m.created_at
from public.commissions m
join public.firms f on f.id = m.firm_id
where m.status = 'reported'
  and m.claim_id is null
  and not exists (
    select 1 from public.purchase_claims c
    where c.firm_id = m.firm_id and upper(trim(c.order_ref)) = upper(trim(m.order_ref))
  )
union all
select 'unpaid', m.firm_id, f.name, m.order_ref, m.amount_cents, m.claim_id, m.id, m.confirmed_at
from public.commissions m
join public.firms f on f.id = m.firm_id
where m.status in ('confirmed', 'released')
  and m.paid_at is null
  and m.confirmed_at < now() - interval '45 days';

-- Finance totals gain paid commission (appended column; existing columns unchanged).
create or replace view public.finance_totals with (security_invoker = true) as
with backing as (
  select coalesce(sum(amount_cents) filter (where status in ('confirmed', 'released')), 0) confirmed_cents,
         coalesce(sum(amount_cents) filter (where status = 'reported'), 0) reported_cents,
         coalesce(sum(amount_cents) filter (where status in ('confirmed', 'released') and paid_at is not null), 0) paid_cents
  from public.commissions
),
balances as (
  select coalesce(sum(greatest(available, 0)), 0) available,
         coalesce(sum(greatest(pending, 0)), 0) pending
  from public.wallet_balances
)
select reported_cents, confirmed_cents, available, pending,
       (pending + available) / nullif(confirmed_cents, 0) liability_ratio,
       paid_cents
from backing, balances;

revoke all on public.commission_reconciliation, public.finance_totals from public, anon, authenticated, service_role;
grant select on public.commission_reconciliation, public.finance_totals to service_role;
revoke execute on function public.mark_commissions_paid(uuid, uuid[], text, date, text, text) from public, anon, authenticated;
grant execute on function public.mark_commissions_paid(uuid, uuid[], text, date, text, text) to service_role;
