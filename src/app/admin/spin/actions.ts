"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fromDbError, requestKey, type ActionResult } from "@/lib/admin/result";
import { requireStaff } from "@/lib/auth/session";
import { rateLimit } from "@/lib/http/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { nullableArg } from "@/lib/supabase/args";

const prize = z.object({
  label: z.string().trim().min(2).max(60),
  kind: z.enum(["xp", "xp_boost", "freeze", "ticket"]),
  value: z.coerce.number().int().min(1).max(500),
  // Entered as a percentage with up to 4 decimals; stored as parts per million.
  percent: z
    .string()
    .trim()
    .regex(/^\d{1,3}(\.\d{1,4})?$/),
  cap: z
    .string()
    .trim()
    .regex(/^\d{0,6}$/),
});

/** Saves the whole prize table at once; the database refuses odds that don't total 100%. */
export async function savePrizes(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireStaff("owner");
  if (!(await rateLimit("adminWrite", user.id))) return { ok: false, key: "limited" };
  const key = requestKey(form);
  const reason = z.string().trim().min(3).max(1000).safeParse(form.get("reason"));
  if (!key || !reason.success) return { ok: false, key: "invalid" };
  const rows = [];
  for (let i = 0; i < 12; i++) {
    const label = form.get(`label_${i}`);
    if (typeof label !== "string" || !label.trim()) continue;
    const parsed = prize.safeParse({
      label,
      kind: form.get(`kind_${i}`),
      value: form.get(`value_${i}`),
      percent: form.get(`percent_${i}`),
      cap: form.get(`cap_${i}`) ?? "",
    });
    if (!parsed.success) return { ok: false, key: "invalid" };
    const [whole = "0", frac = ""] = parsed.data.percent.split(".");
    const ppm = Number(whole) * 10_000 + Number(frac.padEnd(4, "0"));
    rows.push({
      label: parsed.data.label,
      kind: parsed.data.kind,
      value: parsed.data.value,
      odds_ppm: ppm,
      daily_cap: parsed.data.cap || null,
    });
  }
  if (!rows.length) return { ok: false, key: "invalid" };
  if (rows.reduce((s, r) => s + r.odds_ppm, 0) !== 1_000_000)
    return { ok: false, key: "oddsTotal" };
  const { error } = await createAdminClient().rpc("admin_save_spin_prizes", {
    p_actor: user.id,
    p_prizes: rows,
    p_reason: reason.data,
    p_request_id: key,
  });
  if (error) return fromDbError(error);
  revalidatePath("/admin/spin");
  revalidatePath("/rewards");
  return { ok: true };
}

const iso = (v: FormDataEntryValue | null) => {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(`${v}:00Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export async function saveDraw(
  id: string | null,
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireStaff("owner");
  if (!(await rateLimit("adminWrite", user.id))) return { ok: false, key: "limited" };
  const parsed = z
    .object({
      title: z.string().trim().min(3).max(120),
      prize: z.string().trim().min(3).max(300),
      max: z.coerce.number().int().min(1).max(100),
    })
    .safeParse(Object.fromEntries(form));
  const key = requestKey(form);
  const starts = iso(form.get("starts")),
    ends = iso(form.get("ends"));
  if (
    !parsed.success ||
    !key ||
    !starts ||
    !ends ||
    ends <= starts ||
    (id && !z.uuid().safeParse(id).success)
  ) {
    return { ok: false, key: "invalid" };
  }
  const { error } = await createAdminClient().rpc("admin_save_draw", {
    p_actor: user.id,
    p_id: nullableArg(id),
    p_title: parsed.data.title,
    p_prize: parsed.data.prize,
    p_starts: starts,
    p_ends: ends,
    p_max: parsed.data.max,
    p_cancel: form.get("cancel") === "on",
    p_request_id: key,
  });
  if (error) return fromDbError(error);
  revalidatePath("/admin/spin");
  revalidatePath("/draws");
  return { ok: true };
}

export async function runDraw(
  id: string,
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireStaff("owner");
  if (!(await rateLimit("adminWrite", user.id))) return { ok: false, key: "limited" };
  const key = requestKey(form);
  if (!key || !z.uuid().safeParse(id).success) return { ok: false, key: "invalid" };
  const { error } = await createAdminClient().rpc("run_draw", {
    p_actor: user.id,
    p_draw: id,
    p_request_id: key,
  });
  if (error) return fromDbError(error);
  revalidatePath("/admin/spin");
  revalidatePath("/draws");
  return { ok: true };
}
