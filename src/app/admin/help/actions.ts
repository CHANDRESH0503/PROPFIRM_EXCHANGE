"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fromDbError, requestKey, type ActionResult } from "@/lib/admin/result";
import { requireStaff } from "@/lib/auth/session";
import { rateLimit } from "@/lib/http/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { nullableArg } from "@/lib/supabase/args";

const article = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(80),
  category: z.enum(["getting-started", "claims", "coins", "rewards", "journal", "account"]),
  title: z.string().trim().min(3).max(140),
  summary: z.string().trim().min(3).max(300),
  body: z.string().trim().min(3).max(20000),
  status: z.enum(["draft", "published", "archived"]),
});

export async function saveArticle(
  id: string | null,
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireStaff();
  if (!(await rateLimit("adminWrite", user.id))) return { ok: false, key: "limited" };
  const parsed = article.safeParse(Object.fromEntries(form));
  const key = requestKey(form);
  if (!parsed.success || !key || (id && !z.uuid().safeParse(id).success))
    return { ok: false, key: "invalid" };
  const v = parsed.data;
  const { error } = await createAdminClient().rpc("admin_save_article", {
    p_actor: user.id,
    p_id: nullableArg(id),
    p_slug: v.slug,
    p_category: v.category,
    p_title: v.title,
    p_summary: v.summary,
    p_body: v.body,
    p_status: v.status,
    p_request_id: key,
  });
  if (error) return error.code === "23505" ? { ok: false, key: "alreadyDone" } : fromDbError(error);
  revalidatePath("/admin/help");
  revalidatePath("/help", "layout");
  return { ok: true };
}

export async function saveChangelog(
  id: string | null,
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireStaff();
  if (!(await rateLimit("adminWrite", user.id))) return { ok: false, key: "limited" };
  const parsed = z
    .object({
      title: z.string().trim().min(3).max(140),
      body: z.string().trim().min(3).max(4000),
      status: z.enum(["draft", "published", "archived"]),
    })
    .safeParse(Object.fromEntries(form));
  const key = requestKey(form);
  if (!parsed.success || !key || (id && !z.uuid().safeParse(id).success))
    return { ok: false, key: "invalid" };
  const { error } = await createAdminClient().rpc("admin_save_changelog", {
    p_actor: user.id,
    p_id: nullableArg(id),
    p_title: parsed.data.title,
    p_body: parsed.data.body,
    p_status: parsed.data.status,
    p_request_id: key,
  });
  if (error) return fromDbError(error);
  revalidatePath("/admin/changelog");
  revalidatePath("/changelog");
  return { ok: true };
}
