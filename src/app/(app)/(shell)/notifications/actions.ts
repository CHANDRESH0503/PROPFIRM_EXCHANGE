"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOnboarded } from "@/lib/auth/session";
import { rateLimit } from "@/lib/http/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { nullableArg } from "@/lib/supabase/args";

const hour = z.union([z.literal(""), z.coerce.number().int().min(0).max(23)]);
const prefsSchema = z
  .object({
    quiet_start: hour,
    quiet_end: hour,
    daily_cap: z.union([z.literal(""), z.coerce.number().int().min(1).max(50)]),
  })
  .refine(
    (v) =>
      (v.quiet_start === "" && v.quiet_end === "") ||
      (v.quiet_start !== "" && v.quiet_end !== "" && v.quiet_start !== v.quiet_end),
  );

export async function savePreferences(_previous: string, form: FormData) {
  const { user } = await requireOnboarded("/notifications");
  if (!(await rateLimit("inboxWrite", user.id))) return "limited";
  const parsed = prefsSchema.safeParse({
    quiet_start: form.get("quiet_start") ?? "",
    quiet_end: form.get("quiet_end") ?? "",
    daily_cap: form.get("daily_cap") ?? "",
  });
  if (!parsed.success) return "invalidQuiet";
  const v = parsed.data;
  const db = createAdminClient();
  const { error } = await db.rpc("set_inbox_preferences", {
    p_user: user.id,
    p_claim: form.has("claim_status"),
    p_redemption: form.has("redemption_status"),
    p_release: form.has("coins_released"),
    p_journal_review: form.has("journal_review"),
    p_quiet_start: nullableArg(v.quiet_start === "" ? null : v.quiet_start),
    p_quiet_end: nullableArg(v.quiet_end === "" ? null : v.quiet_end),
    p_daily_cap: nullableArg(v.daily_cap === "" ? null : v.daily_cap),
  });
  if (error) return "failed";
  revalidatePath("/notifications");
  return "saved";
}
export async function markRead(_previous: string, form: FormData) {
  const { user } = await requireOnboarded("/notifications");
  if (!(await rateLimit("inboxWrite", user.id))) return "limited";
  const parsed = z.coerce.number().int().positive().safeParse(form.get("id"));
  if (!parsed.success) return "failed";
  const db = createAdminClient();
  const { error } = await db.rpc("read_inbox_item", { p_user: user.id, p_id: parsed.data });
  if (error) return "failed";
  revalidatePath("/notifications");
  return "";
}

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "CNY"] as const;
const digestSchema = z.object({
  currencies: z.array(z.enum(CURRENCIES)).min(1).max(9),
  hour: z.coerce.number().int().min(0).max(23),
});

/** Opt-in daily economic calendar digest: on/off, currencies and the local send hour. */
export async function saveDigest(_previous: string, form: FormData) {
  const { user } = await requireOnboarded("/notifications");
  if (!(await rateLimit("inboxWrite", user.id))) return "limited";
  const active = form.has("digest_on");
  const parsed = digestSchema.safeParse({
    currencies: form.getAll("digest_currency"),
    hour: form.get("digest_hour"),
  });
  if (!parsed.success) return "digestInvalid";
  const { error } = await createAdminClient().rpc("set_calendar_digest", {
    p_user: user.id,
    p_active: active,
    p_currencies: parsed.data.currencies,
    p_send_hour: parsed.data.hour,
  });
  if (error) return "failed";
  revalidatePath("/notifications");
  return "digestSaved";
}
