import type { Route } from "next";
import { createTranslator } from "next-intl";
import { z } from "zod";
import messages from "@/messages/en.json";
import { LOCALE } from "@/i18n/request";

/** Wording for an inbox notification, shared by the inbox page, Telegram and web push. */

const claimStatus = z.enum([
  "submitted",
  "needs_info",
  "flagged",
  "approved",
  "rejected",
  "matched",
  "confirmed",
  "released",
  "reversed",
]);
const redemptionStatus = z.enum(["pending", "fulfilled", "cancelled"]);

const t = createTranslator({ locale: LOCALE, messages });

const money = new Intl.NumberFormat("en-US");
const date = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T12:00:00Z`));

export function inboxMessage(kind: string, detail: string): { title: string; href: Route } | null {
  if (kind === "coins_adjusted") {
    const [raw = "", note = ""] = detail.split("|");
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount === 0) return null;
    const title =
      amount > 0
        ? t("inbox.coinsAdded", { amount: money.format(amount) })
        : t("inbox.coinsRemoved", { amount: money.format(-amount) });
    return { title: note ? `${title} ${note}` : title, href: "/wallet" };
  }
  if (kind === "coins_expiring") {
    const [raw = "", on = ""] = detail.split("|");
    const amount = Number(raw);
    return Number.isFinite(amount) && /^\d{4}-\d{2}-\d{2}$/.test(on)
      ? {
          title: t("inbox.expiring", { amount: money.format(amount), date: date(on) }),
          href: "/wallet",
        }
      : null;
  }
  if (kind === "coins_expired") {
    const amount = Number(detail);
    return Number.isFinite(amount)
      ? { title: t("inbox.expired", { amount: money.format(amount) }), href: "/wallet" }
      : null;
  }
  if (kind === "support_reply")
    return { title: t("inbox.supportReply", { subject: detail }), href: "/support" };
  if (kind === "appeal_decided") {
    return detail === "overturned" || detail === "upheld"
      ? { title: t(`inbox.appeal.${detail}`), href: "/claims" }
      : null;
  }
  if (kind === "data_request") {
    return /^\d{4}-\d{2}-\d{2}$/.test(detail)
      ? { title: t("inbox.deletion", { date: date(detail) }), href: "/profile/data" }
      : null;
  }
  if (kind === "journal_review") {
    return /^\d{4}-\d{2}-\d{2}$/.test(detail)
      ? { title: t("inbox.journalReview", { date: date(detail) }), href: "/accounts/review" }
      : null;
  }
  if (kind === "draw_won") return { title: t("inbox.drawWon", { title: detail }), href: "/draws" };
  if (kind === "coins_released") {
    const amount = Number(detail);
    return Number.isFinite(amount)
      ? { title: t("inbox.release", { amount }), href: "/wallet" }
      : null;
  }
  if (kind === "claim_status") {
    const s = claimStatus.safeParse(detail);
    return s.success
      ? { title: t("inbox.claim", { status: t(`purchase.status.${s.data}`) }), href: "/claims" }
      : null;
  }
  if (kind === "redemption_status") {
    const s = redemptionStatus.safeParse(detail);
    return s.success
      ? { title: t("inbox.reward", { status: t(`shop.${s.data}`) }), href: "/rewards" }
      : null;
  }
  return null;
}
