import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { CoinGlyph } from "@/components/ui/coin-amount";
import { WaitlistForm } from "@/components/waitlist/waitlist-form";
import { brand } from "@/config/brand";
import { coinsForShare, commissionCents } from "@/lib/economy/coins";

/*
 * Pre-launch home: the founding letter (direction contract in .impeccable/surfaces).
 * Fully static. The only request-time read (referral code in the URL) happens inside the
 * client form, behind Suspense, so the page prerenders and Cloudflare can cache it.
 */

// Worked example from docs/spec/05-economy.md, computed with the same arithmetic the ledger uses.
const EXAMPLE_PRICE_CENTS = 15_000;
const EXAMPLE_COMMISSION_BPS = 1_500;
const FOUNDING_SHARE_BPS = 9_000;
const example = (() => {
  const commission = commissionCents(EXAMPLE_PRICE_CENTS, EXAMPLE_COMMISSION_BPS);
  const coins = coinsForShare(commission, FOUNDING_SHARE_BPS);
  return { commission, coins, kept: commission - coins };
})();

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const cents = (c: number) => usd.format(c / 100);

export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      <div className="grid gap-x-16 lg:grid-cols-[minmax(0,62ch)_1fr]">
        {/* The letter */}
        <article className="pt-6 sm:pt-14 lg:pt-20">
          <h1 className="max-w-[14ch] text-[2.125rem] leading-[1.06] font-bold sm:text-5xl lg:text-[3.5rem]">
            {t("headlineBefore")}{" "}
            <span className="font-mono font-bold tracking-[-0.04em] text-gold">{t("headlineFigure")}</span> {t("headlineAfter")}
          </h1>

          <p className="mt-5 text-base leading-[1.65] text-text-soft sm:mt-7 sm:text-lg">{t("lede")}</p>

          <p className="mt-4 text-base leading-[1.65] text-text-soft sm:text-lg">{t("candour")}</p>

          <Suspense fallback={<FormSkeleton />}>
            <WaitlistForm id="waitlist-email" className="mt-6 sm:mt-8" />
          </Suspense>

          {/* The signature closes the letter: a short rule, the name, the role. */}
          <p className="mt-8 w-fit border-t border-hairline pt-3 pr-10">
            <span className="block font-heading text-lg font-semibold text-foreground">{t("signature")}</span>
            <span className="block text-sm text-muted-foreground">{t("signatureRole", { brand: brand.name })}</span>
          </p>

          <section aria-labelledby="promises" className="mt-14 border-t border-hairline pt-12 sm:mt-16 sm:pt-14">
            <h2 id="promises" className="text-2xl font-semibold sm:text-[1.75rem]">
              {t("letterHeading")}
            </h2>
            <dl className="mt-6 divide-y divide-hairline border-y border-hairline">
              {t.raw("promises").map((p: { title: string; body: string }) => (
                <div key={p.title} className="grid gap-1.5 py-5 sm:grid-cols-[14rem_1fr] sm:gap-8">
                  <dt className="font-heading text-base font-semibold text-foreground">{p.title}</dt>
                  <dd className="text-[0.9375rem] leading-relaxed text-text-soft">{p.body}</dd>
                </div>
              ))}
            </dl>
          </section>
        </article>

        {/* The arithmetic: beside the letter on desktop, after it on phones */}
        <aside aria-labelledby="example" className="mt-16 lg:sticky lg:top-8 lg:mt-24 lg:self-start">
          <h2 id="example" className="text-xl font-semibold">
            {t("exampleHeading")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("exampleNote")}</p>

          {/* A ruled statement, read top to bottom like the arithmetic it is. */}
          <div className="mt-6 border-t border-text/70">
            <p className="flex items-center justify-between py-3 text-sm text-muted-foreground">
              <span>{t("exampleRows.program")}</span>
              <span className="text-xs">{t("exampleBadge")}</span>
            </p>
            <dl className="border-t border-hairline text-[0.9375rem]">
              <Row label={t("exampleRows.listPrice")} value={cents(EXAMPLE_PRICE_CENTS)} />
              <Row label={t("exampleRows.commission")} value={cents(example.commission)} />
              <Row label={t("exampleRows.kept")} value={cents(example.kept)} muted />
            </dl>
            <div className="border-t-2 border-double border-text/70 py-4">
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-medium text-foreground">{t("sumLabel")}</span>
                <span className="inline-flex items-baseline gap-1.5 font-mono text-2xl font-bold text-gold tabular">
                  <CoinGlyph className="size-[0.8em]" />
                  {example.coins.toLocaleString("en-US")}
                  <span className="font-sans text-sm font-medium">{t("coinsUnit")}</span>
                </span>
              </div>
              <p className="mt-1 text-right text-sm text-muted-foreground">
                {t("exampleRows.worth", { amount: cents(example.coins) })}
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t("exampleFine")}</p>
        </aside>
      </div>

      {/* Closing reply slip */}
      <section aria-labelledby="closing" className="mt-20 border-t border-hairline pt-12 sm:mt-28">
        <div className="max-w-[62ch]">
          <h2 id="closing" className="text-2xl font-semibold sm:text-[1.75rem]">
            {t("closingHeading")}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-text-soft">{t("closingBody")}</p>
          <Suspense fallback={<FormSkeleton />}>
            <WaitlistForm id="waitlist-email-closing" className="mt-6" showFine={false} />
          </Suspense>
        </div>
      </section>
    </div>
  );
}

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-2.5 last:border-b-0">
      <dt className={muted ? "text-muted-foreground" : "text-text-soft"}>{label}</dt>
      <dd className={`font-mono tabular ${muted ? "text-muted-foreground" : "text-foreground"}`}>{value}</dd>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="mt-6 space-y-3 sm:mt-8" aria-hidden="true">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="h-12 rounded-lg border border-hairline bg-surface sm:flex-1" />
        <div className="h-12 rounded-lg bg-primary/90 sm:w-44" />
      </div>
      <div className="h-4 w-4/5 rounded bg-raised" />
    </div>
  );
}
