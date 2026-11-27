import { z } from "zod";

export const kinds = ["firm", "program", "offer"] as const;
export const assets = ["forex", "cfd", "futures", "stocks", "options", "crypto"] as const;
const text = z.string().trim().min(1).max(120);
const optional = z.string().trim().max(4000);
const https = z.union([z.literal(""), z.url({ protocol: /^https$/ }).max(2000)]);
const whole = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(0).max(2147483647));
const bps = whole.pipe(z.number().max(10000));
const optionalRate = z.union([z.literal("").transform(() => null), bps]);
const date = z
  .string()
  .regex(/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?$/)
  .transform((v) => v + "Z")
  .pipe(z.iso.datetime());
const schedule = z.union([z.literal("").transform(() => null), date]);
const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on");
const firm = z
  .object({
    name: text,
    slug: z
      .string()
      .max(80)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    description: optional,
    asset_classes: z.array(z.enum(assets)).min(1),
    platforms: optional.transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
    status: z.enum(["active", "watch", "delisted"]),
    status_note: optional,
    published_at: schedule,
    logo_url: https.transform((v) => v || null),
    tracking_url: https,
    promo_code: optional,
    commission_bps: bps,
    rebate_permission: checkbox,
    evidence_url: https,
  })
  .refine((v) => !v.rebate_permission || !!v.evidence_url, {
    path: ["evidence_url"],
    message: "evidence",
  })
  .transform(
    ({ tracking_url, promo_code, commission_bps, rebate_permission, evidence_url, ...fields }) => ({
      ...fields,
      agreement: { tracking_url, promo_code, commission_bps, rebate_permission, evidence_url },
    }),
  );
const program = z.object({
  firm_id: z.uuid(),
  name: text,
  account_size: whole.pipe(z.number().positive()),
  steps: whole.pipe(z.number().max(8)),
  list_price_cents: whole,
  currency: z.string().regex(/^[A-Z]{3}$/),
  profit_target_bps: optionalRate,
  daily_loss_bps: optionalRate,
  max_loss_bps: optionalRate,
  profit_split_bps: optionalRate,
  drawdown_type: z.enum(["static", "trailing", "end_of_day"]),
  payout_frequency: text,
  published_at: schedule,
  rules: optional.transform((v, ctx) => {
    try {
      return z.record(z.string(), z.string()).parse(JSON.parse(v || "{}"));
    } catch {
      ctx.addIssue({ code: "custom", message: "rules" });
      return z.NEVER;
    }
  }),
});
const offer = z
  .object({
    firm_id: z.uuid(),
    title: text,
    terms: optional,
    code: z.string().trim().min(1).max(64),
    discount_bps: bps,
    starts_at: date,
    ends_at: date,
    published: checkbox,
    exclusive: checkbox,
    program_ids: z.array(z.uuid()).min(1),
  })
  .refine((v) => Date.parse(v.ends_at) > Date.parse(v.starts_at), {
    path: ["ends_at"],
    message: "schedule",
  });
export const editors = { firm, program, offer };
export const editMeta = z
  .object({
    kind: z.enum(kinds),
    id: z.union([z.literal(""), z.uuid()]),
    revision: whole,
    reason: z.string().trim().min(3).max(1000),
    change_summary: optional,
    source_url: https,
  })
  .refine((v) => !v.change_summary || !!v.source_url, { path: ["source_url"], message: "source" });
