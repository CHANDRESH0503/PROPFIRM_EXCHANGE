import { z } from "zod";
import { ACCOUNT_CURRENCIES } from "@/lib/tools/instruments";
import { zonedInstant } from "@/lib/tools/sessions";
import { toMinor } from "./compute";

/** Form parsing for journal writes. Every value arrives as a string from FormData. */

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const price = z.preprocess(
  blank,
  z
    .string()
    .trim()
    .regex(/^\d{1,12}(\.\d{1,8})?$/)
    .transform(Number)
    .pipe(z.number().positive())
    .optional(),
);
const moneyRequired = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const minor = toMinor(v);
    if (minor === null) {
      ctx.addIssue({ code: "custom", message: "money" });
      return z.NEVER;
    }
    return minor;
  });
const moneyOptional = z.preprocess(blank, moneyRequired.optional());
const scale = z.preprocess(blank, z.coerce.number().int().min(1).max(5).optional());
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

export const symbolSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ""))
  .pipe(z.string().regex(/^[A-Z0-9]{2,12}$/));

/** Wall time from a datetime-local input, read in the member's timezone. */
export function fromLocalInput(value: string, zone: string) {
  const [d, t] = value.split("T") as [string, string];
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  const [h, min] = t.split(":").map(Number) as [number, number];
  return zonedInstant(zone, y, m, day, h, min);
}

export const tradeSchema = z
  .object({
    symbol: symbolSchema,
    direction: z.enum(["long", "short"]),
    opened: z.preprocess(blank, localDateTime.optional()),
    closed: localDateTime,
    lots: z.preprocess(
      blank,
      z
        .string()
        .trim()
        .regex(/^\d{1,8}(\.\d{1,2})?$/)
        .transform(Number)
        .pipe(z.number().positive())
        .optional(),
    ),
    entry: price,
    exit: price,
    stopLoss: price,
    takeProfit: price,
    currency: z.enum(ACCOUNT_CURRENCIES),
    result: moneyRequired,
    commission: moneyOptional,
    swap: moneyOptional,
    strategy: z.preprocess(blank, z.uuid().optional()),
    emotionBefore: scale,
    emotionAfter: scale,
    confidence: scale,
    notes: z.preprocess(blank, z.string().trim().max(4000).optional()),
    tags: z.array(z.uuid()).max(20),
    followed: z.array(z.uuid()).max(20),
    broken: z.array(z.uuid()).max(20),
  })
  .refine((v) => !v.opened || v.opened <= v.closed, { path: ["opened"], message: "order" })
  .refine((v) => !(v.entry && v.stopLoss && v.entry === v.stopLoss), {
    path: ["stopLoss"],
    message: "equal",
  });

export type TradeInput = z.infer<typeof tradeSchema>;

/** Reads a trade form, collecting repeated fields and per-rule choices. */
export function readTradeForm(form: FormData) {
  const one = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : undefined;
  };
  const followed: string[] = [];
  const broken: string[] = [];
  for (const [k, v] of form) {
    if (!k.startsWith("rule:") || typeof v !== "string") continue;
    if (v === "followed") followed.push(k.slice(5));
    if (v === "broken") broken.push(k.slice(5));
  }
  return tradeSchema.safeParse({
    symbol: one("symbol") ?? "",
    direction: one("direction"),
    opened: one("opened"),
    closed: one("closed") ?? "",
    lots: one("lots"),
    entry: one("entry"),
    exit: one("exit"),
    stopLoss: one("stopLoss"),
    takeProfit: one("takeProfit"),
    currency: one("currency"),
    result: one("result") ?? "",
    commission: one("commission"),
    swap: one("swap"),
    strategy: one("strategy"),
    emotionBefore: one("emotionBefore"),
    emotionAfter: one("emotionAfter"),
    confidence: one("confidence"),
    notes: one("notes"),
    tags: form.getAll("tags").filter((v): v is string => typeof v === "string"),
    followed,
    broken,
  });
}

export const quickSchema = z.object({
  symbol: symbolSchema,
  direction: z.enum(["long", "short"]),
  currency: z.enum(ACCOUNT_CURRENCIES),
  result: moneyRequired,
  tag: z.preprocess(blank, z.uuid().optional()),
});

export const strategySchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(2000),
  rules: z.array(z.string().trim().min(1).max(200)).max(20),
});

export const tagSchema = z.object({
  kind: z.enum(["setup", "mistake", "emotion"]),
  name: z.string().trim().min(1).max(40),
});
