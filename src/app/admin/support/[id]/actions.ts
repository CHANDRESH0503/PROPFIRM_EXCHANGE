"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireReviewer } from "@/lib/auth/reviewer";
import { requestMeta } from "@/lib/http/request";
import { rateLimit } from "@/lib/http/rate-limit";
import { fromDbError, type ActionResult } from "@/lib/admin/result";
import { createAdminClient } from "@/lib/supabase/admin";
export async function reviewTicket(
  id: string,
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const user = await requireReviewer();
  if (!(await rateLimit("adminWrite", user.id))) return { ok: false, key: "limited" };
  const values = z
    .object({
      status: z.enum(["open", "waiting_on_user", "resolved"]),
      body: z.string().trim().max(5000),
    })
    .safeParse(Object.fromEntries(form));
  if (!values.success || !z.uuid().safeParse(id).success) return { ok: false, key: "invalid" };
  const { error } = await createAdminClient().rpc("support_reply_staff", {
    p_actor: user.id,
    p_ticket: id,
    p_status: values.data.status,
    p_body: values.data.body,
    p_internal: form.has("internal"),
    p_request_id: (await requestMeta()).requestId,
  });
  if (error) return fromDbError(error);
  revalidatePath(`/admin/support/${id}`);
  revalidatePath("/admin/support");
  revalidatePath("/support");
  return { ok: true };
}
