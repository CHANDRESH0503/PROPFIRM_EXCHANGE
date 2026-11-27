-- Local and staging only. Sample firms have no live affiliate destinations.
begin;
insert into public.firms(id,slug,name,description,asset_classes,platforms,is_sample,published_at)
values
 ('10000000-0000-4000-8000-000000000001','sample-paper-kite','Paper Kite (sample)','Fictional firm for comparing evaluation rules.',array['futures']::public.asset_class[],array['Sample Terminal'],true,now()),
 ('10000000-0000-4000-8000-000000000002','sample-chalk-orbit','Chalk Orbit (sample)','Fictional firm for exploring a two-step evaluation.',array['forex']::public.asset_class[],array['Sample Terminal'],true,now()),
 ('10000000-0000-4000-8000-000000000003','sample-cardboard-tide','Cardboard Tide (sample)','Fictional firm for comparing drawdown limits.',array['cfd']::public.asset_class[],array['Sample Terminal'],true,now())
on conflict(id) do nothing;

insert into public.firm_programs(id,firm_id,name,account_size,steps,list_price_cents,drawdown_type,payout_frequency,
  profit_target_bps,daily_loss_bps,max_loss_bps,profit_split_bps,published_at)
select ('20000000' || substr(f.id::text,9))::uuid,f.id,'Sample evaluation',v.size,v.steps,v.price,v.drawdown,'Monthly',
  800,400,800,8000,now()
from (values ('sample-paper-kite',50000,1,15000,'static'),('sample-chalk-orbit',25000,2,9000,'trailing'),
  ('sample-cardboard-tide',10000,2,6500,'end_of_day')) v(slug,size,steps,price,drawdown)
join public.firms f on f.slug=v.slug and f.is_sample
on conflict(id) do nothing;
-- Demonstrate the price breakdown without a working affiliate link.
insert into public.firm_agreements(firm_id,commission_bps,rebate_permission,evidence_url)
select id,1500,true,'https://example.test/fictional-sample-agreement' from public.firms
where id='10000000-0000-4000-8000-000000000001' and is_sample on conflict do nothing;
insert into public.offers(id,firm_id,title,terms,code,discount_bps,starts_at,ends_at,published)
select '30000000-0000-4000-8000-000000000001',id,'Sample evaluation discount',
  'Fictional offer for comparing costs. No purchase is available.','SAMPLE10',1000,
  '2026-11-01T00:00:00Z','2027-11-01T00:00:00Z',true
from public.firms where id='10000000-0000-4000-8000-000000000001' and is_sample on conflict do nothing;
insert into public.offer_programs(firm_id,offer_id,program_id)
select o.firm_id,o.id,p.id from public.offers o join public.firm_programs p on p.firm_id=o.firm_id
where o.id='30000000-0000-4000-8000-000000000001' and p.id='20000000-0000-4000-8000-000000000001'
on conflict do nothing;
commit;
