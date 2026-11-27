"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { editMeta, editors } from "@/lib/catalogue/editor";
import { rateLimit } from "@/lib/http/rate-limit";
import { requestMeta } from "@/lib/http/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { nullableArg } from "@/lib/supabase/args";

export type EditResult = {
  code: "invalid" | "stale" | "unavailable" | "limited";
  field?: string;
} | null;
export async function saveCatalogue(_prev: EditResult, form: FormData): Promise<EditResult> {
  const { user } = await requireStaff("content");
  if (!(await rateLimit("adminWrite", user.id))) return { code: "limited" };
  const input = Object.fromEntries(form);
  const meta = editMeta.safeParse(input);
  if (!meta.success) return { code: "invalid", field: String(meta.error.issues[0]?.path[0]) };
  const { kind, id, revision, reason, change_summary, source_url } = meta.data;
  const values = editors[kind].safeParse({
    ...input,
    asset_classes: form.getAll("asset_classes"),
    program_ids: form.getAll("program_ids"),
  });
  if (!values.success) return { code: "invalid", field: String(values.error.issues[0]?.path[0]) };
  const { requestId } = await requestMeta();
  const { data, error } = await createAdminClient().rpc("admin_save_catalogue", {
    p_actor: user.id,
    p_kind: kind,
    p_id: nullableArg(id || null),
    p_revision: revision,
    p_reason: reason,
    p_request_id: requestId,
    p_values: { ...values.data, ...(change_summary ? { change_summary, source_url } : {}) },
  });
  if (error)
    return {
      code: error.code === "40001" ? "stale" : error.code === "23505" ? "invalid" : "unavailable",
      field: error.code === "23505" ? "slug" : undefined,
    };
  revalidatePath("/admin/catalogue");
  redirect(`/admin/catalogue?kind=${kind}&id=${data}&saved=1`);
}
