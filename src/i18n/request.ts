import { getRequestConfig } from "next-intl/server";
import messages from "@/messages/en.json";

/**
 * English only at launch, without locale routing. Every user-facing string still goes through
 * next-intl so adding a language later is a messages file plus routing, not a rewrite.
 */
export const LOCALE = "en";

export default getRequestConfig(async () => ({
  locale: LOCALE,
  messages,
  timeZone: "UTC",
}));
