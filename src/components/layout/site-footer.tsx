import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { brand } from "@/config/brand";
import { BrandMark } from "@/components/brand/wordmark";
import { ConsentSettingsLink } from "@/components/analytics/analytics";
import { EXPLORE_LINKS, LEGAL_PAGES, TRUST_PAGES } from "@/config/nav";

/**
 * Footer on every public page. Carries the affiliate and risk disclosure, so any page with an
 * outbound affiliate link satisfies CLAUDE.md §2.8 by inheriting this layout.
 */
export async function SiteFooter() {
  const [t, nav] = await Promise.all([getTranslations("footer"), getTranslations("trustNav")]);
  return (
    <footer className="mt-24 border-t border-hairline bg-[linear-gradient(180deg,rgb(123_77_255/0.10),transparent_60%)]">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-12 sm:grid-cols-2 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-3">
          <p className="flex items-center gap-2 font-heading text-base font-extrabold">
            <BrandMark className="size-7" />
            {brand.name}
          </p>
          <p className="measure text-sm leading-relaxed text-muted-foreground">
            {t("disclosure", { brand: brand.name })}
          </p>
          <p className="text-sm text-muted-foreground">{t("adults")}</p>
        </div>
        <nav aria-label={t("explore")} className="space-y-3">
          <p className="text-xs font-black tracking-[0.12em] text-cyan uppercase">{t("explore")}</p>
          <ul className="space-y-1">
            {EXPLORE_LINKS.map(({ key, href }) => (
              <li key={key}>
                <Link
                  href={href}
                  className="inline-flex min-h-9 items-center text-sm text-muted-foreground hover:text-foreground"
                >
                  {t(`links.${key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label={t("trust")} className="space-y-3">
          <p className="text-xs font-black tracking-[0.12em] text-pink uppercase">{t("trust")}</p>
          <ul className="space-y-1">
            {TRUST_PAGES.map((slug) => (
              <li key={slug}>
                <Link
                  href={`/${slug}`}
                  className="inline-flex min-h-9 items-center text-sm text-muted-foreground hover:text-foreground"
                >
                  {nav(slug)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label={t("legal")} className="space-y-3">
          <p className="text-xs font-black tracking-[0.12em] text-epic uppercase">{t("legal")}</p>
          <ul className="space-y-1">
            {LEGAL_PAGES.map((slug) => (
              <li key={slug}>
                <Link
                  href={`/${slug}`}
                  className="inline-flex min-h-9 items-center text-sm text-muted-foreground hover:text-foreground"
                >
                  {nav(slug)}
                </Link>
              </li>
            ))}
          </ul>
          <ConsentSettingsLink className="inline-flex min-h-9 items-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" />
          <p className="text-xs text-muted-foreground">{t("draftNote")}</p>
        </nav>
      </div>
    </footer>
  );
}
