-- Analytics consent (13-seo-analytics.md: "Respect cookie consent").
--
-- The browser keeps the visitor's choice in a first-party cookie. For a signed-in member the
-- same choice is stored here, so events that happen without the member present (a claim
-- confirmed by staff, Coins released by the hold job) are sent only for members who agreed.
-- Null means never asked; false means declined or withdrawn.
alter table public.profiles
  add column analytics_consent boolean,
  add column analytics_consent_at timestamptz;

create function public.set_analytics_consent(p_user uuid, p_granted boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_granted is null then raise exception 'consent must be true or false' using errcode = '22023'; end if;
  update public.profiles
  set analytics_consent = p_granted, analytics_consent_at = now()
  where id = p_user and analytics_consent is distinct from p_granted;
end;
$$;

revoke execute on function public.set_analytics_consent(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_analytics_consent(uuid, boolean) to service_role;
grant select (analytics_consent) on public.profiles to authenticated;
