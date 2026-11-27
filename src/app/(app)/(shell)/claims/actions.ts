"use server";

import { track } from "@/lib/analytics/server";
import { createHash, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOnboarded } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { nullableArg } from "@/lib/supabase/args";
import { requestMeta } from "@/lib/http/request";
import { rateLimit } from "@/lib/http/rate-limit";
import { verifyTurnstile } from "@/lib/http/turnstile";
import { emailSchema } from "@/lib/validation/schemas";
import { findPrograms } from "@/lib/catalogue/programs";

const input = z.object({
  program: z.uuid(),
  reference: z.string().trim().min(1).max(128),
  email: emailSchema,
  amount: z
    .string()
    .regex(/^\d{1,8}(\.\d{1,2})?$/)
    .transform((s) => {
      const [whole, dec = ""] = s.split(".");
      return Number(whole) * 100 + Number(dec.padEnd(2, "0"));
    })
    .pipe(z.number().positive().max(2147483647)),
  purchased: z.iso.date().refine((v) => v <= new Date().toISOString().slice(0, 10)),
});
export type ClaimError = {
  code: "invalid" | "receipt" | "duplicate" | "captcha" | "limited" | "unavailable";
  field?: string;
} | null;

export async function submitClaim(_prev: ClaimError, form: FormData): Promise<ClaimError> {
  const { user } = await requireOnboarded("/claims");
  if (!(await rateLimit("claimSubmit", user.id))) return { code: "limited" };
  const fields = input.safeParse(Object.fromEntries(form));
  if (!fields.success) return { code: "invalid", field: String(fields.error.issues[0]?.path[0]) };
  const receipt = form.get("receipt");
  if (!(receipt instanceof File) || receipt.size > 4194304 || !receipt.size)
    return { code: "receipt", field: "receipt" };
  const meta = await requestMeta();
  if (
    (await verifyTurnstile(String(form.get("cf-turnstile-response") || ""), meta.ip, "claim")) !==
    "ok"
  )
    return { code: "captcha" };
  const { program, reference, email, amount, purchased } = fields.data;
  const selected = (await findPrograms({}, { ids: [program] })).programs[0];
  if (!selected || selected.is_sample || !selected.rebate_permission)
    return { code: "unavailable" };
  const bytes = Buffer.from(await receipt.arrayBuffer());
  const type = bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
    ? ["png", "image/png"]
    : bytes.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))
      ? ["jpg", "image/jpeg"]
      : bytes.subarray(0, 5).toString() === "%PDF-"
        ? ["pdf", "application/pdf"]
        : null;
  if (!type) return { code: "receipt", field: "receipt" };
  const id = randomUUID();
  const path = user.id + "/" + id + "." + type[0];
  const hash = createHash("sha256").update(bytes).digest("hex");
  const db = createAdminClient();
  const bucket = db.storage.from("receipts");
  const uploaded = await bucket.upload(path, bytes, { contentType: type[1], upsert: false });
  if (uploaded.error) return { code: "unavailable" };
  const { error } = await db.rpc("submit_claim", {
    p_id: id,
    p_user: user.id,
    p_program: program,
    p_ip_country: nullableArg(meta.ipCountry),
    p_order_ref: reference,
    p_amount: amount,
    p_purchased_on: purchased,
    p_email: email,
    p_path: path,
    p_hash: hash,
  });
  if (error) {
    // A Postgres SQLSTATE confirms rollback. A transport failure may hide a committed
    // transaction, so leave its file for the reconciler rather than deleting live proof.
    if (/^[0-9A-Z]{5}$/.test(error.code)) await bucket.remove([path]);
    if (error.code === "23505") {
      const prior = await db
        .from("purchase_claims")
        .select("id,order_ref")
        .eq("user_id", user.id)
        .eq("receipt_hash", hash)
        .eq("program_id", program)
        .maybeSingle();
      if (prior.data?.order_ref.toUpperCase() === reference.toUpperCase()) redirect("/claims");
      return { code: "duplicate" };
    }
    return { code: "unavailable" };
  }
  await track("claim_submitted", user.id, { consent: "request", props: { program } });
  redirect("/claims");
}
