import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/brand/wordmark";

/** Public header. Static: no session read, so public pages stay in the prerendered shell. */
export async function SiteHeader() {
  const t = await getTranslations("nav");
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-3 sm:px-8">
      <Wordmark />
      <nav aria-label="Primary" className="flex items-center gap-1 text-sm">
        <Link href="/how-rewards-work" className="inline-flex min-h-11 items-center rounded-lg px-3 text-muted-foreground hover:text-foreground">
          {t("howItWorks")}
        </Link>
        <Link href="/sign-in" className="inline-flex min-h-11 items-center rounded-lg px-3 text-text-soft hover:text-foreground">
          {t("signIn")}
        </Link>
      </nav>
    </header>
  );
}
