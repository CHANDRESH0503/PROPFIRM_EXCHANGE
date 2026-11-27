-- A join and its delivery intent commit together. Only a nonce is retained:
-- the bearer link also requires a secret held by the application.
create table private.email_outbox (
  signup_id uuid primary key references public.waitlist_signups on delete cascade,
  nonce uuid not null unique,
  token_hash text not null,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease uuid,
  created_at timestamptz not null default now()
);
create index email_outbox_due on private.email_outbox(available_at);
create table private.email_suppressions (email text primary key, created_at timestamptz not null default now());
create table private.email_daily_counts (
  day date primary key,
  sent bigint not null default 0,
  failures bigint not null default 0
);
alter table private.email_outbox enable row level security;
alter table private.email_daily_counts enable row level security;
alter table private.email_suppressions enable row level security;

create function public.waitlist_enqueue(p_email text, p_referral_code text, p_token_hash text, p_ip_hash text,
  p_country text, p_source text, p_nonce uuid)
returns table(signup_id uuid, is_new boolean)
language plpgsql security definer set search_path = '' as $$
declare joined record;
begin
  select * into strict joined from public.waitlist_join(p_email,p_referral_code,p_token_hash,p_ip_hash,p_country,p_source);
  insert into private.email_outbox as q (signup_id,nonce,token_hash)
    values (joined.signup_id,p_nonce,p_token_hash)
    on conflict on constraint email_outbox_pkey do update set nonce=excluded.nonce, token_hash=excluded.token_hash,
      attempts=0, lease=null, available_at=now(), created_at=now();
  return query select joined.signup_id, joined.is_new;
end;
$$;

create function public.lease_email(p_limit integer, p_nonce uuid default null)
returns table(nonce uuid, email text, token_hash text, lease uuid)
language sql security definer set search_path = '' as $$
  with due as (
    select q.signup_id, w.email from private.email_outbox q
    join public.waitlist_signups w on w.id=q.signup_id and w.access_token_hash=q.token_hash
    where q.available_at <= now() and q.created_at > now() - interval '23 hours'
      and (p_nonce is null or q.nonce=p_nonce)
      and not exists (select from private.email_suppressions s where s.email=w.email)
    order by q.available_at, q.signup_id limit greatest(0,least(p_limit,20))
    for update of q skip locked
  )
  update private.email_outbox q set lease=gen_random_uuid(), attempts=attempts+1, available_at=now()+interval '5 minutes'
    from due where due.signup_id=q.signup_id returning q.nonce, due.email, q.token_hash, q.lease;
$$;

create function public.finish_email(p_nonce uuid, p_lease uuid, p_sent boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_sent then
    delete from private.email_outbox where nonce=p_nonce and lease=p_lease;
  else
    update private.email_outbox set lease=null,
      available_at=now()+make_interval(mins=>1 << least(attempts-1,8))
      where nonce=p_nonce and lease=p_lease;
  end if;
  if found then
    insert into private.email_daily_counts as c (day,sent,failures)
    values ((now() at time zone 'UTC')::date,p_sent::integer,(not p_sent)::integer)
    on conflict(day) do update set sent=c.sent+excluded.sent, failures=c.failures+excluded.failures;
  end if;
end;
$$;

create function public.suppress_email(p_email text) returns void
language sql security definer set search_path = '' as $$
  insert into private.email_suppressions (email) values(lower(trim(p_email))) on conflict do nothing;
$$;

create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','success','failed')),
  error_code text
);
create index job_runs_name_started on public.job_runs(name, started_at desc);
alter table public.job_runs enable row level security;
revoke all on public.job_runs from public,anon,authenticated;
grant select,insert,update,delete on public.job_runs to service_role;

revoke execute on function public.waitlist_enqueue(text,text,text,text,text,text,uuid),
  public.lease_email(integer,uuid), public.finish_email(uuid,uuid,boolean), public.suppress_email(text)
  from public,anon,authenticated;
grant execute on function public.waitlist_enqueue(text,text,text,text,text,text,uuid),
  public.lease_email(integer,uuid), public.finish_email(uuid,uuid,boolean), public.suppress_email(text) to service_role;
