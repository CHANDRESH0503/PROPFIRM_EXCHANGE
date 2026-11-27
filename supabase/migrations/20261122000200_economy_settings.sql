create function public.save_economy_settings(p_actor uuid,p_version integer,p_values jsonb,p_reason text,p_request_id text)
returns integer language plpgsql security definer set search_path='' as $$
declare latest public.economy_config%rowtype; config public.economy_config%rowtype; v integer;
begin
 if not exists(select from public.admin_roles where user_id=p_actor and role='owner') or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'owner and reason required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(1709250);
 select * into strict latest from public.economy_config where effective_at<=now() order by effective_at desc limit 1;
 if latest.version is distinct from p_version then raise exception 'stale settings' using errcode='40001';end if;
 config:=jsonb_populate_record(latest,p_values);
 if exists(select from unnest(config.level_share_bps) rate where rate>config.max_total_giveback_bps)
 or config.founding_share_bps>config.max_total_giveback_bps
 or config.level_share_bps<>(select array_agg(rate order by rate) from unnest(config.level_share_bps) rate)
 then raise exception 'inconsistent share limits';end if;
 insert into public.economy_config(effective_at,level_share_bps,founding_share_bps,max_total_giveback_bps,referral_bps,
 hold_days,monthly_cap,founding_starts_at,founding_days,founding_buyers)
 values(now(),config.level_share_bps,config.founding_share_bps,config.max_total_giveback_bps,config.referral_bps,config.hold_days,
 config.monthly_cap,config.founding_starts_at,config.founding_days,config.founding_buyers) returning version into v;
 perform private.write_audit(p_actor,'economy.version','economy_config',v::text,to_jsonb(latest),p_values,p_reason,p_request_id);
 return v;
end;
$$;
revoke execute on function public.save_economy_settings(uuid,integer,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.save_economy_settings(uuid,integer,jsonb,text,text) to service_role;

create function private.founding_badge() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.user_badges(user_id,badge) values(new.user_id,'founding_member') on conflict do nothing;return new;
end;
$$;
revoke execute on function private.founding_badge() from public,anon,authenticated;
create trigger founding_badge after insert on private.founding_members for each row execute function private.founding_badge();
insert into public.user_badges(user_id,badge) select user_id,'founding_member' from private.founding_members on conflict do nothing;
