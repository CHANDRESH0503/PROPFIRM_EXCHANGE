import { connection } from "next/server";
import { currentEconomy } from "@/lib/economy/config";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import Link from "next/link";
import {
  BadgePercent,
  Gem,
  HandCoins,
  Hourglass,
  ShieldCheck,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { ProgramRow } from "@/components/catalogue/directory";
import { findPrograms } from "@/lib/catalogue/programs";
import { ToolDirectory, toolEntries } from "@/components/tools/tool-directory";
import { getTranslations } from "next-intl/server";
import { CoinGlyph } from "@/components/ui/coin-amount";
import { buttonVariants } from "@/components/ui/button";
import { WaitlistForm } from "@/components/waitlist/waitlist-form";
import { brand } from "@/config/brand";
import { coinsForShare, commissionCents } from "@/lib/economy/coins";

// Worked example from docs/spec/05-economy.md, computed with the same arithmetic the ledger uses.
const EXAMPLE_PRICE_CENTS = 15_000;
const EXAMPLE_COMMISSION_BPS = 1_500;
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const cents = (c: number) => usd.format(c / 100);

export default function HomePage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-12 h-96 w-full max-w-5xl rounded-lg" />}>
      <Letter />
    </Suspense>
  );
}
async function Letter() {
  await connection();
  const [config, t, tools] = await Promise.all([
    currentEconomy(),
    getTranslations("home"),
    toolEntries({ journal: true }),
  ]);
  const share = Math.min(config.founding_share_bps, config.max_total_giveback_bps);
  const commission = commissionCents(EXAMPLE_PRICE_CENTS, EXAMPLE_COMMISSION_BPS);
  const coins = coinsForShare(commission, share);
  const example = { commission, coins, kept: commission - coins };
  const rates = {
    share: share / 100,
    kept: (10000 - share) / 100,
    min: config.level_share_bps[0]! / 100,
    max: config.level_share_bps[4]! / 100,
    days: config.founding_days,
    buyers: config.founding_buyers.toLocaleString("en-US"),
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      <div className="grid gap-x-14 gap-y-12 pt-8 sm:pt-12 lg:grid-cols-[minmax(0,60ch)_1fr] lg:pt-16">
        {/* The letter, now the hero */}
        <article>
          <h1 className="max-w-[15ch] text-[2.25rem] leading-[1.02] sm:text-5xl lg:text-[3.6rem]">
            {t("headlineBefore")}{" "}
            <span className="font-mono font-black tracking-[-0.04em] text-gold">
              {rates.share}%
            </span>{" "}
            {t("headlineAfter")}
          </h1>
          <p className="mt-5 text-base leading-[1.65] text-text-soft sm:mt-7 sm:text-lg">
            {t("lede", rates)}
          </p>
          <p className="mt-4 text-base leading-[1.65] text-text-soft sm:text-lg">{t("candour")}</p>
          <ul aria-label={t("chipsLabel")} className="mt-6 flex flex-wrap gap-2">
            {(
              [
                [HandCoins, "var(--gold)", t("chips.share", rates)],
                [Hourglass, "var(--cyan)", t("chips.hold", { hold: config.hold_days })],
                [Wrench, "var(--lime)", t("chips.tools", { count: tools.length })],
                [Sparkles, "var(--violet)", t("chips.xp")],
              ] as const
            ).map(([Icon, hue, label]) => (
              <Chip key={label} icon={Icon} hue={hue} label={label} />
            ))}
          </ul>
          <div className="mt-6 rounded-3xl p-4 frame-brand sm:mt-8 sm:p-5">
            <Suspense fallback={<FormSkeleton />}>
              <WaitlistForm id="waitlist-email" />
            </Suspense>
          </div>
          <p className="mt-6 w-fit border-t border-hairline pt-3 pr-10">
            <span className="block font-heading text-lg font-extrabold text-foreground">
              {t("signature")}
            </span>
            <span className="block text-sm text-muted-foreground">
              {t("signatureRole", { brand: brand.name })}
            </span>
          </p>
        </article>

        {/* The worked example as a loot card */}
        <aside aria-labelledby="example" className="lg:sticky lg:top-8 lg:self-start">
          <div className="relative rounded-3xl p-5 pt-7 frame-gold sm:p-6 sm:pt-8">
            <span className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full bg-gold-beam px-2.5 py-1 text-[0.625rem] font-black tracking-[0.14em] text-ink uppercase shadow-[0_4px_12px_-4px_rgb(5_2_20/0.8)]">
              <Gem className="size-3" aria-hidden="true" />
              {t("exampleBadge")}
            </span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-10 -right-6 size-40 rounded-full bg-[radial-gradient(circle,rgb(255_201_74/0.35),transparent_65%)]"
            />
            <h2 id="example" className="text-xl">
              {t("exampleHeading")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("exampleNote")}</p>
            <p className="mt-4 text-sm font-semibold text-text-soft">{t("exampleRows.program")}</p>
            <dl className="mt-2 rounded-2xl border border-hairline bg-ink-deep/50 px-3.5 text-[0.9375rem]">
              <Row label={t("exampleRows.listPrice")} value={cents(EXAMPLE_PRICE_CENTS)} />
              <Row label={t("exampleRows.commission")} value={cents(example.commission)} />
              <Row label={t("exampleRows.kept", rates)} value={cents(example.kept)} muted />
            </dl>
            {/* The split as a bar: what comes back as Coins versus what we keep. */}
            <div
              className="mt-5 flex h-4 gap-1 overflow-hidden rounded-full bg-ink-deep/80 p-0.5 ring-1 ring-hairline"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full [background-image:linear-gradient(180deg,rgb(255_255_255/0.4),transparent_55%),linear-gradient(90deg,var(--gold),var(--gold-2))] shadow-[0_2px_10px_-2px_rgb(255_157_46/0.8)]"
                style={{ width: `${rates.share}%` }}
              />
              <div className="h-full flex-1 rounded-full bg-common/40" />
            </div>
            <p className="mt-2 flex justify-between text-xs font-semibold" aria-hidden="true">
              <span className="text-gold">{t("splitLegend.you")}</span>
              <span className="text-muted-foreground">{t("splitLegend.us")}</span>
            </p>
            <div className="mt-4 flex items-baseline justify-between gap-4">
              <span className="font-semibold text-foreground">{t("sumLabel", rates)}</span>
              <span className="inline-flex items-baseline gap-1.5 font-mono tabular text-4xl font-black text-gold drop-shadow-[0_4px_16px_rgb(255_157_46/0.45)]">
                <CoinGlyph className="size-[0.75em]" />
                {example.coins.toLocaleString("en-US")}
                <span className="font-sans text-sm font-semibold">{t("coinsUnit")}</span>
              </span>
            </div>
            <p className="mt-1 text-right text-sm text-muted-foreground">
              {t("exampleRows.worth", { amount: cents(example.coins) })}
            </p>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              {t("exampleFine", rates)}
            </p>
          </div>
        </aside>
      </div>

      {/* Promises as a quest log */}
      <section aria-labelledby="promises" className="mt-20 sm:mt-24">
        <h2 id="promises" className="text-2xl sm:text-3xl">
          {t("letterHeading")}
        </h2>
        {/* A quest log: one panel, each promise a row with its own badge and hue. */}
        <ol className="mt-6 divide-y divide-hairline rounded-3xl panel">
          {t.raw("promises").map((p: { title: string; body: string }, i: number) => {
            const [Icon, hue] = PROMISE_BADGES[i % PROMISE_BADGES.length]!;
            return (
              <li
                key={p.title}
                style={{ "--h": hue } as React.CSSProperties}
                className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 p-5 sm:grid-cols-[auto_16rem_1fr] sm:items-center sm:gap-x-6 sm:p-6"
              >
                <span
                  aria-hidden="true"
                  className="row-span-2 grid size-11 place-items-center rounded-2xl border border-[color-mix(in_oklab,var(--h)_50%,transparent)] bg-[color-mix(in_oklab,var(--h)_16%,var(--ink))] text-(--h) shadow-[0_6px_18px_-8px_var(--h)] sm:row-span-1"
                >
                  <Icon className="size-5" strokeWidth={2.25} />
                </span>
                <h3 className="text-base sm:text-lg">{p.title}</h3>
                <p className="col-start-2 text-[0.9375rem] leading-relaxed text-text-soft sm:col-start-3">
                  {p.body.replace("{hold}", String(config.hold_days))}
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Live drops from the real catalogue */}
      <Suspense fallback={<Skeleton className="mt-20 h-80 w-full rounded-2xl" />}>
        <Drops />
      </Suspense>

      {/* Free tools: useful today, before launch, without an account */}
      <section aria-labelledby="home-tools" className="mt-20 sm:mt-24">
        <div className="max-w-[62ch]">
          <h2 id="home-tools" className="text-2xl sm:text-3xl">
            {t("toolsHeading")}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-text-soft">{t("toolsBody")}</p>
        </div>
        <ToolDirectory journal className="mt-8" />
      </section>

      {/* Closing reply slip */}
      <section
        aria-labelledby="closing"
        className="relative mt-20 overflow-hidden rounded-3xl p-6 frame-brand sm:mt-24 sm:p-10"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-[radial-gradient(circle,rgb(224_51_143/0.35),transparent_65%)]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 right-40 size-72 rounded-full bg-[radial-gradient(circle,rgb(47_214_255/0.18),transparent_65%)]"
        />
        <div className="relative max-w-[62ch]">
          <h2 id="closing" className="text-2xl sm:text-3xl">
            {t("closingHeading")}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-text-soft">{t("closingBody", rates)}</p>
          <Suspense fallback={<FormSkeleton />}>
            <WaitlistForm id="waitlist-email-closing" className="mt-6" showFine={false} />
          </Suspense>
        </div>
      </section>
    </div>
  );
}

/** Up to three programs from the catalogue, lowest net price first, as item cards. */
async function Drops() {
  const [t, { programs }] = await Promise.all([
    getTranslations("home"),
    findPrograms({ sort: "net" }),
  ]);
  if (!programs.length) return null;
  return (
    <section
      aria-labelledby="drops"
      className="mt-20 rounded-3xl p-4 pt-6 frame-brand sm:mt-24 sm:p-6 sm:pt-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-[62ch]">
          <h2 id="drops" className="flex items-center gap-2 text-2xl sm:text-3xl">
            {t("dropsHeading")}
            <BadgePercent className="size-6 text-pink" aria-hidden="true" />
          </h2>
          <p className="mt-2 text-text-soft">{t("dropsBody")}</p>
        </div>
        <Link href="/firms" className={buttonVariants({ variant: "secondary", size: "md" })}>
          {t("dropsAll")}
        </Link>
      </div>
      <ul className="mt-8 grid gap-x-4 gap-y-7 md:grid-cols-2 xl:grid-cols-3">
        {programs.slice(0, 3).map((p) => (
          <li key={p.program_id} className="grid">
            <ProgramRow p={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Promise badges: icon and hue per promise, in the order the copy lists them. */
const PROMISE_BADGES: [LucideIcon, string][] = [
  [BadgePercent, "var(--pink)"],
  [HandCoins, "var(--gold)"],
  [Wrench, "var(--cyan)"],
  [ShieldCheck, "var(--violet)"],
];

/** A fact chip: a coloured icon tile and a short, true statement. */
function Chip({ icon: Icon, hue, label }: { icon: LucideIcon; hue: string; label: string }) {
  return (
    <li
      style={{ "--h": hue } as React.CSSProperties}
      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[color-mix(in_oklab,var(--h)_40%,transparent)] bg-[color-mix(in_oklab,var(--h)_12%,var(--ink))] py-1 pr-3.5 pl-1 text-sm font-semibold text-foreground"
    >
      <span className="grid size-7 place-items-center rounded-full bg-[color-mix(in_oklab,var(--h)_28%,transparent)] text-(--h)">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      {label}
    </li>
  );
}

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-2.5 last:border-b-0">
      <dt className={muted ? "text-muted-foreground" : "text-text-soft"}>{label}</dt>
      <dd className={`font-mono tabular ${muted ? "text-muted-foreground" : "text-foreground"}`}>
        {value}
      </dd>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="mt-6 space-y-3 sm:mt-8" aria-hidden="true">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="h-12 rounded-xl border border-hairline bg-ink-deep/60 sm:flex-1" />
        <div className="h-12 rounded-lg bg-primary/90 sm:w-44" />
      </div>
      <div className="h-4 w-4/5 rounded bg-raised" />
    </div>
  );
}
