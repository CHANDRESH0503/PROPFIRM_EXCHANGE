"use server";
import { revalidatePath } from "next/cache";
import { fromDbError, type ActionResult } from "@/lib/admin/result";
import { requireOnboarded } from "@/lib/auth/session";
import { rateLimit } from "@/lib/http/rate-limit";
import { requestMeta } from "@/lib/http/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { nullableArg } from "@/lib/supabase/args";

export type SpinResult = ActionResult & { prize?: string };

/** One free spin a day. The database checks the flag, region, restriction and daily limit. */
export async function spinWheel(): Promise<SpinResult> {
  const { user } = await requireOnboarded("/rewards");
  if (!(await rateLimit("spin", user.id))) return { ok: false, key: "limited" };
  const { data, error } = await createAdminClient()
    .rpc("spin", { p_user: user.id, p_ip_country: nullableArg((await requestMeta()).ipCountry) })
    .single();
  if (error || !data) return fromDbError(error ?? {});
  revalidatePath("/rewards");
  revalidatePath("/today");
  return { ok: true, prize: data.label };
}
