import { createTranslator } from "next-intl";
import messages from "@/messages/en.json";
import { LOCALE } from "./request";

/** Translator for code outside a React render (emails, route handlers). */
export function translator<N extends keyof typeof messages>(namespace: N) {
  return createTranslator({ locale: LOCALE, messages, namespace });
}
