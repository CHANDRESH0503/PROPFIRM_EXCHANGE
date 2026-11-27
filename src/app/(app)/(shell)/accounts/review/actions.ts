"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOnboarded } from "@/lib/auth/session";
import { rateLimit } from "@/lib/http/rate-limit";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { nullableArg } from "@/lib/supabase/args";

export type ReviewState =
  | null
  | { status: "error"; code: "invalid" | "limited" | "stale" | "unavailable"; fields?: string[] }
  | { status: "saved"; xp: number };

const answer = z.string().trim().max(1000);
const reviewSchema = z.object({
  week: z.iso.date(),
  what_worked: answer,
  what_didnt: answer,
  costly_mistake: answer,
  followed_plan: z.enum(["yes", "partly", "no"]),
  feeling: z.coerce.number().int().min(1).max(5),
  next_rule: z.string().trim().max(200),
  previous_rule_kept: z.enum(["yes", "no", ""]).optional(),
});

/** Saves this week's review through the database function (XP once per week, owner only). */
export async function saveReview(_prev: ReviewState, form: FormData): Promise<ReviewState> {
  const { user } = await requireOnboarded("/accounts/review");
  if (!(await rateLimit("journalWrite", user.id))) return { status: "error", code: "limited" };
  const parsed = reviewSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      status: "error",
      code: "invalid",
      fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))],
    };
  const v = parsed.data;
  const { data, error } = await createAdminClient().rpc("save_journal_review", {
    p_user: user.id,
    p_week: v.week,
    p_what_worked: v.what_worked,
    p_what_didnt: v.what_didnt,
    p_costly_mistake: v.costly_mistake,
    p_followed_plan: v.followed_plan,
    p_feeling: v.feeling,
    p_next_rule: v.next_rule,
    // Null when there was no previous rule or the member skipped the question.
    p_previous_rule_kept: nullableArg(
      v.previous_rule_kept === "yes" ? true : v.previous_rule_kept === "no" ? false : null,
    ),
  });
  if (error) {
    if (error.code === "22023" && error.message.includes("review week"))
      return { status: "error", code: "stale" };
    if (error.code === "22023" || error.code === "23514")
      return { status: "error", code: "invalid" };
    log("error", "journal.review_failed", { code: error.code });
    return { status: "error", code: "unavailable" };
  }
  revalidatePath("/accounts", "layout");
  revalidatePath("/today");
  return { status: "saved", xp: data ?? 0 };
}

export async function saveReviewDay(_prev: string, form: FormData): Promise<string> {
  const { user } = await requireOnboarded("/accounts/review");
  if (!(await rateLimit("journalWrite", user.id))) return "limited";
  const day = z.coerce.number().int().min(0).max(6).safeParse(form.get("day"));
  if (!day.success) return "invalid";
  const { error } = await createAdminClient().rpc("set_journal_review_day", {
    p_user: user.id,
    p_day: day.data,
  });
  if (error) {
    log("error", "journal.review_day_failed", { code: error.code });
    return "unavailable";
  }
  revalidatePath("/accounts/review");
  revalidatePath("/today");
  return "saved";
}
