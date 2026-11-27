-- Preferences gain the weekly journal review reminder. The new argument has a default, so
-- existing four-argument callers keep working; the server passes all five.
drop function public.set_inbox_preferences(uuid, boolean, boolean, boolean);
create function public.set_inbox_preferences(
  p_user uuid, p_claim boolean, p_redemption boolean, p_release boolean,
  p_journal_review boolean default true
) returns void language sql security definer set search_path = '' as $$
  insert into public.notification_prefs (user_id, claim_status, redemption_status, coins_released, journal_review)
  values (p_user, p_claim, p_redemption, p_release, p_journal_review)
  on conflict (user_id) do update set
    claim_status = excluded.claim_status, redemption_status = excluded.redemption_status,
    coins_released = excluded.coins_released, journal_review = excluded.journal_review;
$$;
revoke execute on function public.set_inbox_preferences(uuid, boolean, boolean, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.set_inbox_preferences(uuid, boolean, boolean, boolean, boolean)
  to service_role;
