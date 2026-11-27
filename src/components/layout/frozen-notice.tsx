import { getTranslations } from "next-intl/server";
import { getRestriction } from "@/lib/auth/session";

/** Shown on reward screens while a member's rewards are frozen; the database also refuses them. */
export async function FrozenNotice() {
  const restriction = await getRestriction();
  if (restriction?.level !== "frozen") return null;
  const t = await getTranslations("restricted");
  return (
    <div role="status" className="rounded-xl border border-caution/40 bg-caution/10 p-4 text-sm">
      <p className="font-medium text-caution">{t("frozenTitle")}</p>
      <p className="mt-1 text-text-soft">{restriction.member_message ?? t("frozenBody")}</p>
    </div>
  );
}
