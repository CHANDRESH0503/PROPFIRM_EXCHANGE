"use server";
import { z } from "zod";
import { revalidatePath, updateTag } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { rateLimit } from "@/lib/http/rate-limit";
import { requestMeta } from "@/lib/http/request";
import { createAdminClient } from "@/lib/supabase/admin";
const integer = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().nonnegative().max(2147483647));
const share = integer.pipe(z.number().max(10000));
const settings = z.object({
  level_share_bps: z.array(share).length(5),
  hold_days: integer,
  founding_share_bps: share,
  max_total_giveback_bps: share,
  referral_bps: share,
  monthly_cap: integer,
  founding_days: integer.pipe(z.number().positive()),
  founding_buyers: integer.pipe(z.number().positive()),
  founding_starts_at: z.union([
    z.literal("").transform(() => null),
    z
      .string()
      .regex(/^\d{4}-\d\d-\d\dT\d\d:\d\d$/)
      .transform((v) => v + ":00Z")
      .pipe(z.iso.datetime()),
  ]),
  version: integer,
  reason: z.string().trim().min(3).max(1000),
});
export async function saveEconomy(_prev: string, form: FormData) {
  const { user } = await requireStaff("owner");
  if (!(await rateLimit("adminWrite", user.id))) return "limited";
  const parsed = settings.safeParse({
    ...Object.fromEntries(form),
    level_share_bps: form.getAll("level_share_bps"),
  });
  if (!parsed.success) return "invalid";
  const { version, reason, ...values } = parsed.data;
  const { error } = await createAdminClient().rpc("save_economy_settings", {
    p_actor: user.id,
    p_version: version,
    p_values: values,
    p_reason: reason,
    p_request_id: (await requestMeta()).requestId,
  });
  if (error) return error.code === "40001" ? "stale" : "invalid";
  updateTag("economy_config");
  revalidatePath("/");
  revalidatePath("/admin/economy");
  return "saved";
}
