/**
 * `supabase gen types` types every SQL function argument as non-null, but Postgres passes NULL
 * through for arguments the function treats as optional (for example `p_referral_code` in
 * waitlist_join, which the function checks with `is not null`). This is the one sanctioned place
 * to express that, instead of ad-hoc casts at call sites.
 */
export function nullableArg<T>(value: T | null | undefined): T {
  return (value ?? null) as T;
}
