import "server-only";
import { cookies } from "next/headers";
import { sha256Hex } from "@/lib/crypto";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

export const WAITLIST_COOKIE = "fb_wl";

export function waitlistCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}

export interface WaitlistMember {
  status: "pending" | "confirmed";
  referralCode: string;
  confirmedReferrals: number;
  position: number | null;
  totalConfirmed: number;
}

/** The member identified by the waitlist cookie, or null. */
export async function currentWaitlistMember(): Promise<WaitlistMember | null> {
  const token = (await cookies()).get(WAITLIST_COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const { data, error } = await createAdminClient().rpc("waitlist_open", { p_token_hash: sha256Hex(token) });
  if (error) {
    log("error", "waitlist.view_failed", { code: error.code });
    throw new Error("waitlist unavailable");
  }
  if (!data?.signup_id || !data.status || !data.referral_code) return null;
  return {
    status: data.status,
    referralCode: data.referral_code,
    confirmedReferrals: data.confirmed_referrals ?? 0,
    position: data.position === null ? null : Number(data.position),
    totalConfirmed: Number(data.total_confirmed ?? 0),
  };
}
