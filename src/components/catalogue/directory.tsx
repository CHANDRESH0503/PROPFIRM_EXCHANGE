import { DealSheet } from "./deal-sheet";
import { getSessionUser, getProfile } from "@/lib/auth/session";
import { requestMeta } from "@/lib/http/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { cache } from "react";
import Link from "next/link";
import { BadgePercent, SlidersHorizontal, Trophy } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button, buttonVariants } from "@/components/ui/button";
import { ItemFrame, RarityTab, StatBlock } from "@/components/game/rarity";
import { CoinGlyph } from "@/components/game/progress";
import { rarityFor, sizeLabel } from "@/lib/catalogue/rarity";
import { cn } from "@/lib/utils";
import {
  findPrograms,
  money,
  parseFilters,
  type Search,
  type Program,
} from "@/lib/catalogue/programs";

type Mode = "firms" | "deals";
const control =
  "mt-1 block h-11 w-full rounded-xl border border-hairline bg-ink-deep/60 px-3 text-sm text-foreground";
const ASSETS = ["forex", "futures", "crypto", "cfd", "stocks", "options"] as const;
const SORTS = ["net", "list", "newest", "name"] as const;
// Deals are ordered by offer end date unless another sort is chosen (findPrograms).
const DEAL_SORTS = ["ends", "net", "list", "newest"] as const;
const chip = (on: boolean) =>
  cn(
    "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors",
    on
      ? "border-transparent bg-beam text-white shadow-[0_6px_16px_-6px_rgb(194_34_119/0.8)]"
      : "border-hairline bg-surface/70 text-text-soft hover:border-brand/60 hover:text-foreground",
  );

export async function Directory({ mode, search }: { mode: Mode; search: Search }) {
  const t = await getTranslations("catalogue");
  const f = parseFilters(search);
  const { programs, count, page, pageSize } = await findPrograms(search, {
    deals: mode === "deals",
  });
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(search)) if (typeof v === "string") params.set(k, v);
  const link = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams(params);
    q.delete("page");
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    const qs = q.toString();
    return (qs ? `/${mode}?${qs}` : `/${mode}`) as `/${Mode}`;
  };
  const pageLink = (n: number) => {
    const q = new URLSearchParams(params);
    q.set("page", String(n));
    return `/${mode}?${q}` as const;
  };
  const sort = mode === "deals" && f.sort === "name" ? "ends" : f.sort;
  const more = (["size", "steps", "max", "platform", "payout", "drawdown"] as const).some(
    (k) => f[k] !== undefined && f[k] !== "",
  );
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-5 py-8 sm:px-8 sm:py-10">
      <header className="max-w-2xl space-y-2">
        <h1 className="flex items-center gap-3 text-3xl sm:text-4xl">
          <span
            aria-hidden="true"
            className={cn(
              "grid size-11 place-items-center rounded-2xl text-white shadow-[0_8px_20px_-8px_rgb(194_34_119/0.9)]",
              mode === "deals"
                ? "bg-[linear-gradient(135deg,var(--pink),var(--legendary))]"
                : "bg-beam",
            )}
          >
            {mode === "deals" ? <BadgePercent className="size-6" /> : <Trophy className="size-6" />}
          </span>
          {t(mode)}
        </h1>
        <p className="text-text-soft">{t(mode === "deals" ? "dealsIntro" : "intro")}</p>
      </header>
      {search.outbound === "unavailable" && (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
        >
          {t("outboundUnavailable")}
        </p>
      )}

      <nav
        aria-label={t("asset")}
        className="-mx-5 flex snap-x gap-2 overflow-x-auto [mask-image:linear-gradient(90deg,black_85%,transparent)] px-5 pb-1 sm:mx-0 sm:flex-wrap sm:[mask-image:none] sm:px-0"
      >
        <Link
          href={link({ asset: null })}
          className={cn(chip(!f.asset), "snap-start")}
          aria-current={!f.asset ? "true" : undefined}
        >
          {t("all")}
        </Link>
        {ASSETS.map((a) => (
          <Link
            key={a}
            href={link({ asset: a })}
            className={cn(chip(f.asset === a), "snap-start")}
            aria-current={f.asset === a ? "true" : undefined}
          >
            {t(`assets.${a}`)}
          </Link>
        ))}
      </nav>
      <div className="-mx-5 flex snap-x items-center gap-2 overflow-x-auto [mask-image:linear-gradient(90deg,black_85%,transparent)] px-5 pb-1 sm:mx-0 sm:flex-wrap sm:[mask-image:none] sm:px-0">
        <span className="shrink-0 text-sm text-muted-foreground">{t("sort")}</span>
        {(mode === "deals" ? DEAL_SORTS : SORTS).map((v) => (
          <Link
            key={v}
            href={link({ sort: v })}
            className={cn(chip(sort === v), "min-h-9 shrink-0 snap-start px-3 text-xs")}
            aria-current={sort === v ? "true" : undefined}
          >
            {t(v === "ends" ? "ends_sort" : v)}
          </Link>
        ))}
      </div>

      <form method="get" className="rounded-2xl px-4 panel">
        {f.asset ? <input type="hidden" name="asset" value={f.asset} /> : null}
        <input type="hidden" name="sort" value={f.sort} />
        <details open={more || undefined}>
          <summary className="flex min-h-12 cursor-pointer items-center gap-2 font-semibold">
            <SlidersHorizontal className="size-4 text-cyan" aria-hidden="true" />
            {t("filter")}
          </summary>
          <div className="grid grid-cols-2 gap-4 pb-4 sm:grid-cols-3 lg:grid-cols-6">
            {(["size", "steps", "max", "platform", "payout"] as const).map((k) => (
              <label key={k} className="text-sm text-text-soft">
                {t(k)}
                <input
                  className={control}
                  name={k}
                  defaultValue={f[k]}
                  type={k === "platform" || k === "payout" ? "text" : "number"}
                  min="0"
                  step={k === "max" ? "0.01" : "1"}
                />
              </label>
            ))}
            <label className="text-sm text-text-soft">
              {t("drawdown")}
              <select className={control} name="drawdown" defaultValue={f.drawdown}>
                <option value="">{t("all")}</option>
                {(["static", "trailing", "end_of_day"] as const).map((v) => (
                  <option value={v} key={v}>
                    {t(v)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-5 pb-4">
            <Button>{t("apply")}</Button>
            <Link className="underline" href={mode === "firms" ? "/firms" : "/deals"}>
              {t("clear")}
            </Link>
          </div>
        </details>
      </form>

      {programs.length ? (
        <form action="/compare" method="get" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl">{t("results", { count })}</h2>
            <Button variant="secondary">{t("compare")}</Button>
          </div>
          <ul className="grid gap-x-4 gap-y-6 pt-2 md:grid-cols-2 xl:grid-cols-3">
            {programs.map((p) => (
              <li key={p.program_id} className="grid">
                <ProgramRow p={p} compare />
              </li>
            ))}
          </ul>
        </form>
      ) : (
        <div className="space-y-2 rounded-2xl p-6 panel">
          <h2 className="text-xl">{t("empty")}</h2>
          <Link className="inline-flex min-h-11 items-center underline" href={`/${mode}`}>
            {t("browse")}
          </Link>
        </div>
      )}
      <nav className="flex gap-5">
        {page > 1 && (
          <Link className="inline-flex min-h-11 items-center underline" href={pageLink(page - 1)}>
            {t("previous")}
          </Link>
        )}
        {page * pageSize < count && (
          <Link className="inline-flex min-h-11 items-center underline" href={pageLink(page + 1)}>
            {t("next")}
          </Link>
        )}
      </nav>
    </div>
  );
}

const agreementFor = cache(async (id: string) => {
  const { data, error } = await createAdminClient()
    .from("firm_agreements")
    .select("promo_code")
    .eq("firm_id", id)
    .not("tracking_url", "is", null)
    .maybeSingle();
  if (error) throw new Error("agreement_unavailable");
  return data;
});
const pct = (bps: number | null | undefined) =>
  bps === null || bps === undefined ? "—" : `${+(bps / 100).toFixed(2)}%`;

/** One program as an item card: rarity by size, rule stat block, prices, and the deal action. */
export async function ProgramRow({ p, compare = false }: { p: Program; compare?: boolean }) {
  const t = await getTranslations("catalogue");
  const agreement =
    !p.is_sample && p.firm_status === "active" ? await agreementFor(p.firm_id) : null;
  const [user, profile, meta] = agreement
    ? await Promise.all([getSessionUser(), getProfile(), requestMeta()])
    : [null, null, null];
  const rarity = rarityFor(p.account_size);
  const discount = p.discount_bps > 0 ? Math.round(p.discount_bps / 100) : 0;
  return (
    <ItemFrame rarity={rarity} className="flex flex-col gap-3">
      <RarityTab
        rarity={rarity}
        label={`${t(`rarity.${rarity}`)} · ${sizeLabel(p.account_size)}`}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/firms/${p.slug}`}
            className="inline-flex min-h-9 items-center font-heading text-lg leading-tight font-extrabold [font-stretch:108%] underline-offset-4 hover:underline"
          >
            {p.firm_name}
          </Link>
          <p className="text-sm text-text-soft">
            {p.program_name} · {t("stepsCount", { n: p.steps })} ·{" "}
            {t(
              p.drawdown_type === "trailing"
                ? "trailing"
                : p.drawdown_type === "end_of_day"
                  ? "end_of_day"
                  : "static",
            )}
          </p>
        </div>
        {discount ? (
          <span className="shrink-0 -rotate-3 rounded-lg border border-dashed border-pink/70 bg-pink/15 px-2 py-1 font-mono tabular text-xs font-black text-pink shadow-[0_4px_12px_-4px_rgb(255_95_174/0.7)]">
            {t("affix", { pct: discount })}
          </span>
        ) : null}
      </div>
      <StatBlock
        stats={[
          { label: t("statTarget"), value: pct(p.profit_target_bps) },
          { label: t("statDaily"), value: pct(p.daily_loss_bps) },
          { label: t("statMax"), value: pct(p.max_loss_bps) },
          { label: t("statSplit"), value: pct(p.profit_split_bps) },
        ]}
      />
      <div className="flex items-end justify-between gap-3">
        <p className="font-mono tabular">
          {p.checkout_cents < p.list_price_cents ? (
            <s className="mr-2 text-sm text-muted-foreground">
              {money(p.list_price_cents, p.currency)}
            </s>
          ) : null}
          <span className="text-[1.65rem] font-black tracking-tight">
            {money(p.checkout_cents, p.currency)}
          </span>
          <span className="sr-only"> {t("checkout")}</span>
        </p>
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">
        {t("netShort")}{" "}
        <span className="font-mono tabular font-semibold text-foreground">
          {money(p.net_cents, p.currency)}
        </span>
      </p>
      {p.estimated_coins > 0 ? (
        <p className="inline-flex items-center gap-1.5 self-start rounded-full border border-gold/40 bg-gold-soft px-2.5 py-1 text-xs font-semibold text-gold">
          <CoinGlyph className="size-3.5" />
          {t("earnBack", { coins: p.estimated_coins.toLocaleString("en-US") })}
        </p>
      ) : null}
      {p.offer_id && (
        <p className="text-xs text-muted-foreground">
          {p.offer_title} · <code className="font-mono">{p.offer_code}</code> ·{" "}
          {t("ends", {
            date: new Date(p.ends_at).toISOString().slice(0, 16).replace("T", " ") + " UTC",
          })}
        </p>
      )}
      <div className="mt-auto space-y-2">
        {agreement ? (
          <DealSheet
            program={p.program_id}
            name={p.firm_name + " · " + p.program_name}
            code={p.offer_code || agreement.promo_code}
            guest={!user}
            eligible={p.rebate_permission}
            needsCountry={!profile?.country_code && !meta?.ipCountry}
          />
        ) : (
          <Link href={`/firms/${p.slug}`} className={buttonVariants({ block: true })}>
            {t("viewProgram")}
          </Link>
        )}
        {compare ? (
          <label className="flex min-h-11 items-center gap-2 text-sm text-text-soft">
            <input
              type="checkbox"
              name="program"
              value={p.program_id}
              className="size-4 accent-[var(--brand)]"
              aria-label={t("select", { program: p.firm_name + " " + p.program_name })}
            />
            {t("addCompare")}
          </label>
        ) : null}
      </div>
    </ItemFrame>
  );
}
