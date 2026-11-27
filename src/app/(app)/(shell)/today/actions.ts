"use server";
import { track } from "@/lib/analytics/server";
import { revalidatePath } from "next/cache";
import { requireOnboarded } from "@/lib/auth/session";
import { rateLimit } from "@/lib/http/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export async function checkIn() {
  const { user } = await requireOnboarded("/today");
  if (!(await rateLimit("checkin", user.id))) return { ok: false, xp: 0 };
  const { data, error } = await createAdminClient().rpc("daily_checkin", { p_user: user.id });
  if (error || !data) return { ok: false, xp: 0 };
  revalidatePath("/today");
  await track("checkin", user.id, { consent: "request", props: { xp: data.awarded_xp } });
  return { ok: true, xp: data.awarded_xp };
}
