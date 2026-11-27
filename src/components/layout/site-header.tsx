import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AccountLink, SessionWordmark } from "./session-links";

const base =
  "min-h-10 items-center rounded-full px-2.5 text-sm font-semibold whitespace-nowrap text-text-soft transition-colors hover:bg-brand/15 hover:text-foreground sm:px-3.5";
const link = `inline-flex ${base}`;

/**
 * Public header. Static: no session read on the server, so public pages stay in the prerendered
 * shell; the session-dependent links resolve in the browser (session-links.tsx).
 */
export async function SiteHeader() {
  const t = await getTranslations("nav");
  return (
    <header className="sticky top-0 z-30 border-b border-hairline/60 bg-ink-deep/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:px-8">
        <SessionWordmark />
        <nav aria-label="Primary" className="flex items-center gap-0.5 text-sm">
          <Link href="/firms" className={link}>
            {t("firms")}
          </Link>
          <Link href="/deals" className={link}>
            {t("deals")}
          </Link>
          <Link href="/tools" className={link}>
            {t("tools")}
          </Link>
          <Link href="/how-rewards-work" className={`hidden md:inline-flex ${base}`}>
            {t("howItWorks")}
          </Link>
          <AccountLink
            signIn={t("signIn")}
            openApp={t("openApp")}
            className="ml-1 inline-flex min-h-10 items-center rounded-full bg-beam px-4 text-sm font-bold whitespace-nowrap text-white shadow-[0_6px_18px_-6px_rgb(194_34_119/0.8)] hover:brightness-110"
          />
        </nav>
      </div>
    </header>
  );
}
