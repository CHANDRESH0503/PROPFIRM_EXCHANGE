"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fromDbError, type ActionResult } from "@/lib/admin/result";
import { requireOnboarded } from "@/lib/auth/session";
import { rateLimit } from "@/lib/http/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { nullableArg } from "@/lib/supabase/args";

const ticket = z.object({
  topic: z.enum(["claim", "redemption", "coins", "account", "journal", "other"]),
  subject: z.string().trim().min(3).max(140),
  body: z.string().trim().min(10).max(5000),
  link: z.string().trim().max(80),
});

export async function openTicket(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireOnboarded("/support");
  if (!(await rateLimit("supportWrite", user.id))) return { ok: false, key: "limited" };
  const parsed = ticket.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, key: "invalid" };
  // "claim:<id>" or "redemption:<id>" from the picker.
  const [kind, ref] = parsed.data.link.split(":");
  const linked = z.uuid().safeParse(ref).success ? ref : null;
  const { data, error } = await createAdminClient().rpc("support_open", {
    p_user: user.id,
    p_topic: parsed.data.topic,
    p_subject: parsed.data.subject,
    p_body: parsed.data.body,
    p_claim: nullableArg(kind === "claim" ? linked : null),
    p_redemption: nullableArg(kind === "redemption" ? linked : null),
  });
  if (error || !data) return fromDbError(error ?? {});
  revalidatePath("/support");
  redirect(`/support/${data}`);
}

export async function replyTicket(
  ticketId: string,
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireOnboarded("/support");
  if (!(await rateLimit("supportWrite", user.id))) return { ok: false, key: "limited" };
  const body = z.string().trim().min(1).max(5000).safeParse(form.get("body"));
  if (!body.success || !z.uuid().safeParse(ticketId).success) return { ok: false, key: "invalid" };
  const { error } = await createAdminClient().rpc("support_reply_member", {
    p_user: user.id,
    p_ticket: ticketId,
    p_body: body.data,
  });
  if (error) return fromDbError(error);
  revalidatePath(`/support/${ticketId}`);
  return { ok: true, key: "sent" };
}
