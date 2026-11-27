"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireOnboarded } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { nullableArg } from "@/lib/supabase/args";
import { requestMeta } from "@/lib/http/request";
import { rateLimit } from "@/lib/http/rate-limit";
import { fromDbError, type ActionResult } from "@/lib/admin/result";
export async function enterDraw(id: string): Promise<ActionResult> {
  const { user } = await requireOnboarded("/draws");
  if (!(await rateLimit("drawEntry", user.id))) return { ok: false, key: "limited" };
  if (!z.uuid().safeParse(id).success) return { ok: false, key: "invalid" };
  const { error } = await createAdminClient().rpc("enter_draw", {
    p_user: user.id,
    p_draw: id,
    p_ip_country: nullableArg((await requestMeta()).ipCountry),
  });
  if (error) return fromDbError(error);
  revalidatePath("/draws");
  return { ok: true };
}
