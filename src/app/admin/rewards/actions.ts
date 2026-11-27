"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { requireReviewer } from "@/lib/auth/reviewer";
import { rateLimit } from "@/lib/http/rate-limit";
import { requestMeta } from "@/lib/http/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { nullableArg } from "@/lib/supabase/args";
import { env } from "@/lib/env";
import { sealVoucher } from "@/lib/economy/vouchers";
import { COUNTRY_CODES } from "@/lib/geo/countries";
const note = z.string().trim().min(3).max(1000);
const date = z.union([
  z.literal("").transform(() => null),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    .transform((v) => v + ":00Z")
    .pipe(z.iso.datetime()),
]);
const schema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(3000),
    instructions: z.string().trim().min(1).max(3000),
    kind: z.enum(["booster", "free_challenge_voucher", "discount_voucher"]),
    program_id: z.union([z.literal("").transform(() => null), z.uuid()]),
    cost_coins: z.coerce.number().int().positive().max(2147483647),
    per_user_limit: z.union([
      z.literal("").transform(() => null),
      z.coerce.number().int().positive(),
    ]),
    min_tier: z.coerce.number().int().min(1).max(5),
    low_stock: z.coerce.number().int().min(0),
    countries: z
      .string()
      .transform((v) =>
        v
          .split(",")
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean),
      )
      .pipe(z.array(z.enum(COUNTRY_CODES))),
    starts_at: date,
    ends_at: date,
    active: z
      .string()
      .optional()
      .transform((v) => v === "on"),
  })
  .refine((v) => v.kind === "booster" || !!v.program_id)
  .refine((v) => !v.starts_at || !v.ends_at || v.ends_at > v.starts_at);
export async function saveReward(_prev: string, form: FormData) {
  const { user } = await requireStaff("finance");
  if (!(await rateLimit("adminWrite", user.id))) return "limited";
  const fields = Object.fromEntries(form),
    parsed = schema.safeParse(fields);
  const meta = z
    .object({
      id: z.union([z.literal(""), z.uuid()]),
      revision: z.coerce.number().int(),
      reason: note,
    })
    .safeParse(fields);
  if (!parsed.success || !meta.success) return "invalid";
  const { data, error } = await createAdminClient().rpc("admin_save_reward", {
    p_actor: user.id,
    p_id: nullableArg(meta.data.id || null),
    p_revision: meta.data.revision,
    p_values: parsed.data,
    p_reason: meta.data.reason,
    p_request_id: (await requestMeta()).requestId,
  });
  if (error) return error.code === "40001" ? "stale" : "unavailable";
  revalidatePath("/rewards");
  revalidatePath("/admin/rewards");
  redirect(`/admin/rewards?id=${data}&saved=1`);
}
export async function addVouchers(_prev: string, form: FormData) {
  const { user } = await requireStaff("finance");
  if (!(await rateLimit("adminWrite", user.id))) return "limited";
  const parsed = z
    .object({ id: z.uuid(), codes: z.string().max(150000), expiry: date, reason: note })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return "invalid";
  const { id, codes, expiry, reason } = parsed.data;
  const unique = [
    ...new Set(
      codes
        .split(/\r?\n/)
        .map((c) => c.trim())
        .filter(Boolean),
    ),
  ];
  if (!unique.length || unique.length > 500 || unique.some((c) => c.length > 256)) return "invalid";
  const key = env().VOUCHER_ENCRYPTION_KEY;
  if (!key) return "keyMissing";
  let encrypted;
  try {
    encrypted = unique.map((code) => sealVoucher(code, id, key));
  } catch {
    return "keyMissing";
  }
  const { error } = await createAdminClient().rpc("stock_vouchers", {
    p_actor: user.id,
    p_reward: id,
    p_codes: encrypted,
    p_expiry: nullableArg(expiry),
    p_reason: reason,
    p_request_id: (await requestMeta()).requestId,
  });
  if (error) return "unavailable";
  revalidatePath("/admin/rewards");
  revalidatePath("/rewards");
  return "stocked";
}
export async function cancelReward(_prev: string, form: FormData) {
  const user = await requireReviewer();
  if (!(await rateLimit("adminWrite", user.id))) return "limited";
  const parsed = z.object({ id: z.uuid(), reason: note }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return "invalid";
  const { error } = await createAdminClient().rpc("cancel_redemption", {
    p_actor: user.id,
    p_id: parsed.data.id,
    p_reason: parsed.data.reason,
    p_request_id: (await requestMeta()).requestId,
  });
  if (error) return "unavailable";
  revalidatePath("/admin/rewards");
  revalidatePath("/rewards");
  revalidatePath("/wallet");
  return "refunded";
}
