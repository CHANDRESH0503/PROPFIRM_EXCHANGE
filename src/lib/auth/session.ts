import "server-only";
import { cache } from "react";
import type { Route } from "next";
import { forbidden, redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

/**
 * The Data Access Layer for identity. Every page, action and route that needs a user goes
 * through these helpers; the proxy's redirect is only an optimistic shortcut.
 */
export type AdminRole = Enums<"admin_role">;

export interface SessionUser {
  id: string;
  email: string | null;
  /** Authenticator assurance level of this session: aal2 means MFA was used. */
  aal: "aal1" | "aal2";
}

export interface Profile {
  id: string;
  display_name: string | null;
  country_code: string | null;
  timezone: string | null;
  onboarded_at: string | null;
  referral_code: string;
  created_at: string;
}

/** Verified user for this request, or null. Deduplicated per render. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // Identity is request-time by nature (token expiry is checked against the clock).
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    aal: claims.aal === "aal2" ? "aal2" : "aal1",
  };
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, country_code, timezone, onboarded_at, referral_code, created_at")
    .eq("id", user.id)
    .maybeSingle();
  return data;
});

export const getRoles = cache(async (): Promise<AdminRole[]> => {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("admin_roles").select("role").eq("user_id", user.id);
  return (data ?? []).map((r) => r.role);
});

export function safeNext(next: string | null | undefined, fallback: Route = "/today"): Route {
  // Only same-site absolute paths; rejects "//evil.com" and "/\evil.com".
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\"))
    return fallback;
  return next as Route;
}

export type Restriction = {
  level: "frozen" | "suspended" | "banned";
  member_message: string | null;
};

/** The member's own restriction, if any (RLS: own row, without the internal reason). */
export const getRestriction = cache(async (): Promise<Restriction | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("member_restrictions")
    .select("level, member_message")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error("restriction_unavailable");
  if (!data) return null;
  const level = data.level === "suspended" || data.level === "banned" ? data.level : "frozen";
  return { level, member_message: data.member_message };
});

export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}` as Route);
  // Suspended and banned members cannot use the signed-in app (09-admin.md §9).
  const restriction = await getRestriction();
  if (restriction && restriction.level !== "frozen") redirect("/restricted");
  return user;
}

/** Signed in and onboarded (country, timezone, 18+). */
export async function requireOnboarded(
  next?: string,
): Promise<{ user: SessionUser; profile: Profile }> {
  const user = await requireUser(next);
  const profile = await getProfile();
  if (!profile?.onboarded_at)
    redirect(`/onboarding${next ? `?next=${encodeURIComponent(next)}` : ""}` as Route);
  return { user, profile };
}

export function hasRole(roles: readonly AdminRole[], role?: AdminRole): boolean {
  if (roles.includes("owner")) return true;
  return role ? roles.includes(role) : roles.length > 0;
}

/**
 * Staff gate for /admin. Non-staff get a 403, staff without MFA on this session are sent
 * to set it up or verify it (09-admin.md: admin sessions require two-factor authentication).
 */
export async function requireStaff(
  role?: AdminRole,
): Promise<{ user: SessionUser; roles: AdminRole[] }> {
  const user = await requireUser("/admin");
  const roles = await getRoles();
  if (!hasRole(roles, role)) forbidden();
  if (user.aal !== "aal2") redirect("/admin/mfa");
  return { user, roles };
}
