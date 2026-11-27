"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fromDbError, requestKey, type ActionResult } from "@/lib/admin/result";
import { requireStaff } from "@/lib/auth/session";
import { rateLimit } from "@/lib/http/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { nullableArg } from "@/lib/supabase/args";

const id = z.uuid();
const reason = z.string().trim().min(3).max(1000);

function done(member: string, error: { code?: string; message?: string } | null): ActionResult {
  if (error) return fromDbError(error);
  revalidatePath(`/admin/users/${member}`);
  return { ok: true };
}

export async function setRestriction(
  member: string,
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireStaff();
  if (!(await rateLimit("adminWrite", user.id))) return { ok: false, key: "limited" };
  const parsed = z
    .object({
      level: z.enum(["none", "frozen", "suspended", "banned"]),
      reason,
      message: z.string().trim().max(500),
    })
    .safeParse(Object.fromEntries(form));
  const key = requestKey(form);
  if (!parsed.success || !id.safeParse(member).success || !key)
    return { ok: false, key: "invalid" };
  const { error } = await createAdminClient().rpc("admin_set_restriction", {
    p_actor: user.id,
    p_user: member,
    // null lifts the restriction.
    p_level: nullableArg(parsed.data.level === "none" ? null : parsed.data.level),
    p_reason: parsed.data.reason,
    p_message: parsed.data.message,
    p_request_id: key,
  });
  return done(member, error);
}

export async function grantCoins(
  member: string,
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireStaff();
  if (!(await rateLimit("adminWrite", user.id))) return { ok: false, key: "limited" };
  const parsed = z
    .object({
      budget: z.uuid(),
      amount: z.coerce.number().int().positive().max(1_000_000),
      reason,
      note: z.string().trim().max(300),
    })
    .safeParse(Object.fromEntries(form));
  const key = requestKey(form);
  if (!parsed.success || !id.safeParse(member).success || !key)
    return { ok: false, key: "invalid" };
  const { error } = await createAdminClient().rpc("admin_grant_coins", {
    p_actor: user.id,
    p_user: member,
    p_budget: parsed.data.budget,
    p_amount: parsed.data.amount,
    p_reason: parsed.data.reason,
    p_member_note: parsed.data.note,
    p_confirmed: form.get("confirmed") === "on",
    p_request_id: key,
  });
  return done(member, error);
}

export async function removeCoins(
  member: string,
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireStaff();
  if (!(await rateLimit("adminWrite", user.id))) return { ok: false, key: "limited" };
  const parsed = z
    .object({
      amount: z.coerce.number().int().positive().max(1_000_000),
      reason,
      note: z.string().trim().max(300),
    })
    .safeParse(Object.fromEntries(form));
  const key = requestKey(form);
  if (!parsed.success || !id.safeParse(member).success || !key)
    return { ok: false, key: "invalid" };
  const { error } = await createAdminClient().rpc("admin_remove_coins", {
    p_actor: user.id,
    p_user: member,
    p_amount: parsed.data.amount,
    p_reason: parsed.data.reason,
    p_member_note: parsed.data.note,
    p_confirmed: form.get("confirmed") === "on",
    p_request_id: key,
  });
  return done(member, error);
}

export async function adjustXp(
  member: string,
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireStaff();
  if (!(await rateLimit("adminWrite", user.id))) return { ok: false, key: "limited" };
  const parsed = z
    .object({
      amount: z.coerce
        .number()
        .int()
        .min(-100_000)
        .max(100_000)
        .refine((n) => n !== 0),
      reason,
    })
    .safeParse(Object.fromEntries(form));
  const key = requestKey(form);
  if (!parsed.success || !id.safeParse(member).success || !key)
    return { ok: false, key: "invalid" };
  const { error } = await createAdminClient().rpc("admin_adjust_xp", {
    p_actor: user.id,
    p_user: member,
    p_amount: parsed.data.amount,
    p_reason: parsed.data.reason,
    p_request_id: key,
  });
  return done(member, error);
}

const BOOSTERS = {
  giveback3: { kind: "giveback", value: 300, hours: 0 },
  giveback5: { kind: "giveback", value: 500, hours: 0 },
  xp24: { kind: "xp", value: 2, hours: 24 },
  freeze1: { kind: "freeze", value: 1, hours: 0 },
} as const;

export async function grantBooster(
  member: string,
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireStaff();
  if (!(await rateLimit("adminWrite", user.id))) return { ok: false, key: "limited" };
  const parsed = z
    .object({ booster: z.enum(["giveback3", "giveback5", "xp24", "freeze1"]), reason })
    .safeParse(Object.fromEntries(form));
  const key = requestKey(form);
  if (!parsed.success || !id.safeParse(member).success || !key)
    return { ok: false, key: "invalid" };
  const b = BOOSTERS[parsed.data.booster];
  const { error } = await createAdminClient().rpc("admin_grant_booster", {
    p_actor: user.id,
    p_user: member,
    p_kind: b.kind,
    p_value: b.value,
    p_hours: b.hours,
    p_reason: parsed.data.reason,
    p_request_id: key,
  });
  return done(member, error);
}

export async function addNote(
  member: string,
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireStaff();
  if (!(await rateLimit("adminWrite", user.id))) return { ok: false, key: "limited" };
  const parsed = z
    .object({ body: z.string().trim().min(1).max(2000) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success || !id.safeParse(member).success) return { ok: false, key: "invalid" };
  const { error } = await createAdminClient().rpc("admin_add_note", {
    p_actor: user.id,
    p_user: member,
    p_body: parsed.data.body,
  });
  return done(member, error);
}

export async function saveBudget(
  budgetId: string | null,
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireStaff();
  if (!(await rateLimit("adminWrite", user.id))) return { ok: false, key: "limited" };
  const parsed = z
    .object({
      name: z.string().trim().min(3).max(120),
      purpose: z.string().trim().min(3).max(500),
      cap: z.coerce.number().int().positive().max(100_000_000),
      ends: z.string().trim().max(30),
      reason,
    })
    .safeParse(Object.fromEntries(form));
  const key = requestKey(form);
  if (!parsed.success || !key || (budgetId && !id.safeParse(budgetId).success))
    return { ok: false, key: "invalid" };
  const ends = parsed.data.ends ? new Date(parsed.data.ends) : null;
  if (ends && Number.isNaN(ends.getTime())) return { ok: false, key: "invalid" };
  const { error } = await createAdminClient().rpc("admin_save_budget", {
    p_actor: user.id,
    p_id: nullableArg(budgetId),
    p_name: parsed.data.name,
    p_purpose: parsed.data.purpose,
    p_cap: parsed.data.cap,
    p_starts: nullableArg<string>(null),
    p_ends: nullableArg(ends?.toISOString()),
    p_active: form.get("active") === "on",
    p_reason: parsed.data.reason,
    p_request_id: key,
  });
  if (error) return fromDbError(error);
  revalidatePath("/admin/campaigns");
  return { ok: true };
}
