"use server";
import { recordMissionEvent } from "@/lib/engagement/missions";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/session";
import { rateLimit } from "@/lib/http/rate-limit";
import { indicativePrices } from "@/lib/prices/provider";
import {
  calculator,
  evaluate,
  isCalculator,
  toSearch,
  withDefaults,
  type CalculatorKey,
} from "@/lib/tools/calculators";

export type UseResult = "recorded" | "skipped";

function fields(form: FormData) {
  const raw: Record<string, string> = {};
  for (const [k, v] of form) if (typeof v === "string") raw[k] = v.slice(0, 40);
  return raw;
}

async function valid(tool: CalculatorKey, raw: Record<string, string>) {
  const calc = calculator(tool);
  const market = await indicativePrices();
  return evaluate(calc, withDefaults(calc, raw), market?.prices).status === "ok";
}

/** The mission is idempotent per member and local day in the database. */
async function credit(userId: string) {
  await recordMissionEvent(userId, "calculator_used");
}

/**
 * JavaScript path: the form already shows the result and only needs the mission credit.
 * Credit needs a valid result from the member's own figures, so an empty call earns nothing.
 */
export async function recordCalculatorUse(tool: string, form: FormData): Promise<UseResult> {
  const raw = fields(form);
  if (!isCalculator(tool) || !(await valid(tool, raw))) return "skipped";
  const profile = await getProfile();
  if (!profile?.onboarded_at || !(await rateLimit("mission", profile.id))) return "skipped";
  await credit(profile.id);
  return "recorded";
}

/** No-JavaScript path: credit the mission, then show the result from the URL. */
export async function submitCalculator(tool: string, form: FormData) {
  if (!isCalculator(tool)) redirect("/tools");
  const raw = fields(form);
  if (await valid(tool, raw)) {
    const profile = await getProfile();
    if (profile?.onboarded_at && (await rateLimit("mission", profile.id))) await credit(profile.id);
  }
  const calc = calculator(tool);
  const search = toSearch(calc, withDefaults(calc, raw));
  redirect(search ? `/tools/${tool}?${search}` : `/tools/${tool}`);
}
