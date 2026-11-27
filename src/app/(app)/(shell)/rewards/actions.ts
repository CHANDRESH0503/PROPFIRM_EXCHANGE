"use server";
import { track } from "@/lib/analytics/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireOnboarded } from "@/lib/auth/session";
import { rateLimit } from "@/lib/http/rate-limit";
import { requestMeta } from "@/lib/http/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { nullableArg } from "@/lib/supabase/args";
import { openVoucher } from "@/lib/economy/vouchers";
import { env } from "@/lib/env";

export async function chooseReward(_prev: string, form: FormData) {
  const { user } = await requireOnboarded("/rewards");
  if (!(await rateLimit("rewardWrite", user.id))) return "limited";
  const id = z.uuid().safeParse(form.get("reward"));
  if (!id.success) return "changed";
  const ipCountry = nullableArg((await requestMeta()).ipCountry);
  const db = createAdminClient();
  if (form.get("intent") === "goal") {
    const { error } = await db.rpc("set_reward_goal", {
      p_user: user.id,
      p_reward: id.data,
      p_ip_country: ipCountry,
    });
    if (error) return "changed";
    revalidatePath("/today");
    revalidatePath("/rewards");
    return "goalSaved";
  }
  const input = z
    .object({
      request: z.uuid(),
      cost: z.coerce.number().int().positive(),
      intent: z.literal("redeem"),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return "changed";
  const { error } = await db.rpc("redeem_reward", {
    p_user: user.id,
    p_reward: id.data,
    p_request: input.data.request,
    p_expected_cost: input.data.cost,
    p_ip_country: ipCountry,
  });
  if (error)
    return error.message.includes("insufficient")
      ? "insufficient"
      : error.message.includes("booster already held")
        ? "held"
        : "changed";
  revalidatePath("/rewards");
  revalidatePath("/today");
  revalidatePath("/wallet");
  await track("redemption_requested", user.id, {
    consent: "request",
    props: { reward: id.data, coins: input.data.cost },
  });
  return "redeemed";
}

export type Reveal = { value: string } | { error: true } | null;
export async function revealVoucher(_prev: Reveal, form: FormData): Promise<Reveal> {
  const { user } = await requireOnboarded("/rewards");
  if (!(await rateLimit("rewardWrite", user.id))) return { error: true };
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { error: true };
  // RLS proves this redemption belongs to the caller before the privileged inventory read.
  const db = await createClient();
  const own = await db
    .from("redemptions")
    .select("reward_id")
    .eq("id", id.data)
    .eq("status", "fulfilled")
    .maybeSingle();
  if (!own.data) return { error: true };
  const { data } = await createAdminClient()
    .from("voucher_inventory")
    .select("ciphertext")
    .eq("redemption_id", id.data)
    .eq("reward_id", own.data.reward_id)
    .maybeSingle();
  const key = env().VOUCHER_ENCRYPTION_KEY;
  if (!key || !data) return { error: true };
  try {
    return { value: openVoucher(data.ciphertext, own.data.reward_id, key) };
  } catch {
    return { error: true };
  }
}
