-- A committed source transition and its in-app delivery share one transaction.
create table public.notification_prefs (
  user_id uuid primary key references public.profiles on delete cascade,
  claim_status boolean not null default true,
  redemption_status boolean not null default true,
  coins_released boolean not null default true
);
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('claim_status','redemption_status','coins_released')),
  event_key text not null,
  detail text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id,kind,event_key)
);
create index notifications_inbox on public.notifications(user_id,id desc);
alter table public.notifications enable row level security;
alter table public.notification_prefs enable row level security;
revoke all on public.notifications, public.notification_prefs from public,anon,authenticated,service_role;
grant select on public.notifications, public.notification_prefs to authenticated,service_role;
create policy own_inbox on public.notifications for select to authenticated using (user_id=(select auth.uid()));
create policy own_preferences on public.notification_prefs for select to authenticated using (user_id=(select auth.uid()));

create function private.deliver_in_app(p_user uuid,p_kind text,p_key text,p_detail text)
returns void language sql security definer set search_path='' as $$
  insert into public.notifications(user_id,kind,event_key,detail)
  select p_user,p_kind,p_key,p_detail where p_user is not null and coalesce((
    select case p_kind when 'claim_status' then p.claim_status when 'redemption_status'
      then p.redemption_status when 'coins_released' then p.coins_released end
    from public.notification_prefs p where p.user_id=p_user
  ),true) on conflict(user_id,kind,event_key) do nothing;
$$;

create function private.notify_claim_status() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' or new.status is distinct from old.status then
    perform private.deliver_in_app(new.user_id,'claim_status',new.id||':'||pg_current_xact_id()::text||':'||new.status,new.status);
  end if;
  return null;
end;
$$;
create trigger notify_claim after insert or update of status on public.purchase_claims
for each row execute function private.notify_claim_status();

-- In-stock redemptions move from pending to fulfilled in one transaction. Only
-- advertise the committed state, including when multiple trigger events were queued.
create function private.notify_redemption_status() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid; final_status text;
begin
  select w.user_id,d.status into recipient,final_status from public.redemptions d
  join public.wallet_accounts w on w.id=d.wallet_id where d.id=new.id;
  if new.status=final_status then
    perform private.deliver_in_app(recipient,'redemption_status',new.id||':'||final_status,final_status);
  end if;
  return null;
end;
$$;
create constraint trigger notify_redemption after insert or update of status on public.redemptions
deferrable initially deferred for each row execute function private.notify_redemption_status();

create function private.notify_coin_release() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform private.deliver_in_app((select user_id from public.wallet_accounts where id=new.wallet_id),
    'coins_released',new.id::text,new.amount::text);
  return null;
end;
$$;
create trigger notify_release after insert on public.ledger_entries for each row
when (new.type='release' and new.bucket='available' and new.amount>0)
execute function private.notify_coin_release();

create function public.set_inbox_preferences(p_user uuid,p_claim boolean,p_redemption boolean,p_release boolean)
returns void language sql security definer set search_path='' as $$
  insert into public.notification_prefs(user_id,claim_status,redemption_status,coins_released)
  values(p_user,p_claim,p_redemption,p_release) on conflict(user_id) do update set
    claim_status=excluded.claim_status,redemption_status=excluded.redemption_status,coins_released=excluded.coins_released;
$$;
create function public.read_inbox_item(p_user uuid,p_id bigint) returns void language sql security definer set search_path='' as $$
  update public.notifications set read_at=now() where user_id=p_user and id=p_id and read_at is null;
$$;
revoke execute on function private.deliver_in_app(uuid,text,text,text), private.notify_claim_status(),
  private.notify_redemption_status(),private.notify_coin_release(),public.set_inbox_preferences(uuid,boolean,boolean,boolean),
  public.read_inbox_item(uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.set_inbox_preferences(uuid,boolean,boolean,boolean),public.read_inbox_item(uuid,bigint) to service_role;
