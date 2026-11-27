"use server";
import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { translator } from "@/i18n/translator";
import { fromDbError, type ActionResult } from "@/lib/admin/result";
import { requireOnboarded, requireUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/http/rate-limit";
import { sendEmail } from "@/lib/notifications/email";
import { noticeEmail } from "@/lib/notifications/templates";
import { publicEnv } from "@/lib/public-env";
import { createAdminClient } from "@/lib/supabase/admin";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Sends the confirmation link. Nothing is scheduled until the member confirms from email. */
export async function requestDeletion(): Promise<ActionResult> {
  const { user } = await requireOnboarded("/profile/data");
  if (!(await rateLimit("dataRequest", user.id))) return { ok: false, key: "limited" };
  if (!user.email) return { ok: false, key: "unavailable" };
  const token = randomBytes(32).toString("base64url");
  const { error } = await createAdminClient().rpc("request_deletion", {
    p_user: user.id,
    p_hash: hash(token),
  });
  if (error) return fromDbError(error);
  const t = translator("dataRights");
  const url = new URL("/account/delete", publicEnv.siteUrl);
  url.searchParams.set("token", token);
  const sent = await sendEmail({
    ...noticeEmail({
      subject: t("email.subject"),
      heading: t("email.heading"),
      paragraphs: [t("email.body1"), t("email.body2")],
      action: { label: t("email.action"), url: url.toString() },
    }),
    to: user.email,
    template: "delete_confirm",
    idempotencyKey: `delete:${hash(token)}`,
  });
  if (!sent.ok) return { ok: false, key: "unavailable" };
  revalidatePath("/profile/data");
  return { ok: true, key: "sent" };
}

export async function confirmDeletion(token: string): Promise<ActionResult> {
  const user = await requireUser("/account/delete");
  if (!(await rateLimit("dataRequest", user.id))) return { ok: false, key: "limited" };
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return { ok: false, key: "notFound" };
  const { error } = await createAdminClient().rpc("confirm_deletion", {
    p_user: user.id,
    p_hash: hash(token),
  });
  if (error) return fromDbError(error);
  redirect("/profile/data?scheduled=1");
}

export async function cancelDeletion(): Promise<ActionResult> {
  const { user } = await requireOnboarded("/profile/data");
  if (!(await rateLimit("dataRequest", user.id))) return { ok: false, key: "limited" };
  const { error } = await createAdminClient().rpc("cancel_deletion", { p_user: user.id });
  if (error) return fromDbError(error);
  revalidatePath("/profile/data");
  return { ok: true };
}
