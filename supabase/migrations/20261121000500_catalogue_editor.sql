alter table public.firms add column revision integer not null default 1;
alter table public.firm_programs add column revision integer not null default 1;
alter table public.offers add column revision integer not null default 1;

-- One transaction per staff edit, including its agreement/program assignments and audit row.
-- Archive by unpublishing. Identifiers remain stable for claims and price history.
create function public.admin_save_catalogue(p_actor uuid,p_kind text,p_id uuid,p_revision integer,
 p_values jsonb,p_reason text,p_request_id text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  target regclass;
  editable text[];
  assignments text;
  columns_sql text;
  before_row jsonb;
  after_row jsonb;
  agreement jsonb;
  selected_ids uuid[];
  v_id uuid:=coalesce(p_id,gen_random_uuid());
begin
  if not exists(select from public.admin_roles where user_id=p_actor and role in ('owner','content')) then
    raise exception 'content role required' using errcode='42501';
  end if;
  if length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'reason required'; end if;
  case p_kind
    when 'firm' then
      target:='public.firms'::regclass;
      editable:=array['slug','name','description','asset_classes','platforms','status','status_note','logo_url','published_at'];
    when 'program' then
      target:='public.firm_programs'::regclass;
      editable:=array['firm_id','name','account_size','steps','list_price_cents','currency','profit_target_bps','daily_loss_bps',
        'max_loss_bps','profit_split_bps','drawdown_type','payout_frequency','rules','published_at'];
    when 'offer' then
      target:='public.offers'::regclass;
      editable:=array['firm_id','title','terms','code','discount_bps','exclusive','starts_at','ends_at','published'];
    else raise exception 'unknown entity';
  end case;
  if p_id is not null then
    execute format('select to_jsonb(r) from %s r where id=$1 for update',target) into before_row using p_id;
    if before_row is null or (before_row->>'revision')::integer is distinct from p_revision then
      raise exception 'stale edit' using errcode='40001';
    end if;
    if p_kind in ('program','offer') and (p_values ? 'firm_id') and p_values->>'firm_id' is distinct from before_row->>'firm_id' then
      raise exception 'parent firm cannot be reassigned';
    end if;
  end if;
  select string_agg(format('%I',k),',') into columns_sql from unnest(editable) k where p_values ? k;
  if columns_sql is null then raise exception 'no editable values'; end if;
  if before_row is null then
    execute format('insert into %s as r (id,%s) select $2,%s from jsonb_populate_record(null::%s,$1) returning to_jsonb(r)',
      target,columns_sql,columns_sql,target) into after_row using p_values,v_id;
  else
    assignments:=format('(%s)=(select %s from jsonb_populate_record(null::%s,$1))',columns_sql,columns_sql,target);
    execute format('update %s as r set %s, revision=r.revision+1 where id=$2 returning to_jsonb(r)',target,assignments)
      into after_row using p_values,v_id;
  end if;
  if p_kind='firm' and p_values ? 'agreement' then
    agreement:=p_values->'agreement';
    if before_row is not null then
      before_row:=before_row||jsonb_build_object('agreement',(select to_jsonb(a) from public.firm_agreements a where firm_id=v_id));
    end if;
    insert into public.firm_agreements(firm_id,tracking_url,promo_code,commission_bps,rebate_permission,evidence_url)
    values(v_id,nullif(agreement->>'tracking_url',''),nullif(agreement->>'promo_code',''),(agreement->>'commission_bps')::integer,
      (agreement->>'rebate_permission')::boolean,nullif(agreement->>'evidence_url',''))
    on conflict(firm_id) do update set tracking_url=excluded.tracking_url,promo_code=excluded.promo_code,
      commission_bps=excluded.commission_bps,rebate_permission=excluded.rebate_permission,evidence_url=excluded.evidence_url;
    after_row:=after_row||jsonb_build_object('agreement',agreement);
  elsif p_kind='offer' and p_values ? 'program_ids' then
    selected_ids:=array(select distinct value::uuid from jsonb_array_elements_text(p_values->'program_ids'));
    if cardinality(selected_ids)=0 then raise exception 'select a program'; end if;
    if before_row is not null then
      before_row:=before_row||jsonb_build_object('program_ids',(select jsonb_agg(program_id) from public.offer_programs where offer_id=v_id));
    end if;
    delete from public.offer_programs where offer_id=v_id;
    insert into public.offer_programs(firm_id,offer_id,program_id)
    select (after_row->>'firm_id')::uuid,v_id,unnest(selected_ids);
    after_row:=after_row||jsonb_build_object('program_ids',selected_ids);
  end if;
  if p_values ? 'change_summary' then
    insert into public.firm_changes(firm_id,summary,source_url,published_at)
    values(coalesce((after_row->>'firm_id')::uuid,v_id),p_values->>'change_summary',p_values->>'source_url',now());
  end if;
  perform private.write_audit(p_actor,'catalogue.save',p_kind,v_id::text,before_row,after_row,p_reason,p_request_id);
  return v_id;
end;
$$;
revoke execute on function public.admin_save_catalogue(uuid,text,uuid,integer,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.admin_save_catalogue(uuid,text,uuid,integer,jsonb,text,text) to service_role;
