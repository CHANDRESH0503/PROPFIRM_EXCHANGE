import { z } from "zod";
import { COUNTRY_CODES } from "@/lib/geo/countries";

/** Shared input schemas. Every server boundary parses with one of these (CLAUDE.md §4). */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ error: "Enter a valid email address." }));

export const referralCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6,16}$/);

export const waitlistJoinSchema = z.object({
  email: emailSchema,
  ref: referralCodeSchema.optional().catch(undefined),
  source: z
    .string()
    .trim()
    .max(64)
    .regex(/^[a-z0-9_.-]*$/i)
    .optional()
    .catch(undefined),
  turnstileToken: z.string().max(2048).optional(),
});

export const signInSchema = z.object({
  email: emailSchema,
  next: z.string().max(512).optional(),
  ref: referralCodeSchema.optional().catch(undefined),
  turnstileToken: z.string().max(2048).optional(),
});

const timezones = new Set(Intl.supportedValuesOf("timeZone"));
timezones.add("UTC");

export const onboardingSchema = z.object({
  country: z.enum(COUNTRY_CODES, { error: "Choose your country." }),
  timezone: z
    .string()
    .max(64)
    .refine((tz) => timezones.has(tz), { error: "Choose your time zone." }),
  isAdult: z.literal(true, { error: "You must be 18 or older to use this site." }),
  next: z.string().max(512).optional(),
});

export const flagUpdateSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{1,62}$/),
  enabled: z.boolean(),
  reason: z.string().trim().min(5, { error: "Give a reason of at least 5 characters." }).max(1000),
});
