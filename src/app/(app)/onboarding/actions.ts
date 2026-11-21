"use server";

import { redirect } from "next/navigation";
import { requireUser, safeNext } from "@/lib/auth/session";
import { rateLimit } from "@/lib/http/rate-limit";
import { log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";
import { onboardingSchema } from "@/lib/validation/schemas";

export interface OnboardingValues {
  country: string;
  timezone: string;
  isAdult: boolean;
}

/**
 * Errors carry the submitted values back, so the form keeps them even when it was submitted
 * before hydration (a plain form post re-renders the page from this state).
 */
export type OnboardingState =
  | { status: "idle" }
  | {
      status: "error";
      values: OnboardingValues;
      fieldErrors: Partial<Record<"country" | "timezone" | "isAdult", string>>;
      code?: "rate_limited" | "unavailable";
    };

export async function completeOnboarding(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const user = await requireUser("/onboarding");
  const values: OnboardingValues = {
    country: String(formData.get("country") ?? "").slice(0, 2),
    timezone: String(formData.get("timezone") ?? "").slice(0, 64),
    isAdult: formData.get("isAdult") === "on",
  };
  const parsed = onboardingSchema.safeParse({ ...values, next: formData.get("next") || undefined });
  if (!parsed.success) {
    const fieldErrors: Partial<Record<"country" | "timezone" | "isAdult", string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof typeof fieldErrors;
      fieldErrors[key] ??= issue.message;
    }
    return { status: "error", values, fieldErrors };
  }

  if (!(await rateLimit("onboarding", user.id))) return { status: "error", values, fieldErrors: {}, code: "rate_limited" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_onboarding", {
    p_country: parsed.data.country,
    p_timezone: parsed.data.timezone,
    p_is_adult: true,
  });
  // Already onboarded (a double submit, or a second tab): treat as done.
  if (error && !error.message.includes("already_onboarded")) {
    log("error", "onboarding.failed", { userId: user.id, code: error.code });
    return { status: "error", values, fieldErrors: {}, code: "unavailable" };
  }
  redirect(safeNext(parsed.data.next));
}
