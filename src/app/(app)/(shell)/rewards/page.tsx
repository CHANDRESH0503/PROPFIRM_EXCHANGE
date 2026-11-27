import { TitleIcon } from "@/components/layout/title-icon";
import { Gift } from "lucide-react";
import { ItemFrame, RarityTab } from "@/components/game/rarity";
import { Lock } from "lucide-react";
import { CoinCounter, XpBar } from "@/components/game/progress";
import { rarityFor, sizeLabel } from "@/lib/catalogue/rarity";
import { SpinSection } from "@/components/engagement/spin-section";
import { FrozenNotice } from "@/components/layout/frozen-notice";
import { Suspense } from "react";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireOnboarded } from "@/lib/auth/session";
import { walletBalance } from "@/lib/economy/wallet";
import { requestMeta } from "@/lib/http/request";
import { nullableArg } from "@/lib/supabase/args";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Skeleton } from "@/components/ui/skeleton";
import { CoinAmount } from "@/components/ui/coin-amount";
import { RewardControls, RevealCode } from "./forms";
export const metadata = { title: "Rewards" };
export default function Page(props: PageProps<"/rewards">) {
  return (
    <Suspense fallback={<Skeleton className="h-72 rounded-lg" />}>
      <Shop {...props} />
    </Suspense>
  );
}
async function Shop({ searchParams }: PageProps<"/rewards">) {
  const { user } = await requireOnboarded("/rewards");
  const [t, c] = await Promise.all([getTranslations("shop"), getTranslations("catalogue")]);
  const query = await searchParams;
  const db = await createClient();
  const [balance, shop, orders] = await Promise.all([
    walletBalance(user.id),
    createAdminClient()
      .rpc("member_rewards", {
        p_user: user.id,
        p_ip_country: nullableArg((await requestMeta()).ipCountry),
      })
      .order("cost_coins")
      .order("id"),
    db
      .from("redemptions")
      .select("id,reward_id,reward_name,instructions,status,cost_coins,target_at,staff_note")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (shop.error || orders.error) throw new Error("reward_shop_unavailable");
  const ids = orders.data.filter((d) => d.status === "fulfilled").map((d) => d.id);
  const vouchers = ids.length
    ? await createAdminClient()
        .from("voucher_inventory")
        .select("redemption_id")
        .in("redemption_id", ids)
    : null;
  if (vouchers?.error) throw new Error("reward_history_unavailable");
  const codes = new Set(vouchers?.data?.map((v) => v.redemption_id));
  const firms = [...new Set(shop.data.flatMap((r) => (r.firm_name ? [r.firm_name] : [])))].sort();
  const sizes = [
    ...new Set(shop.data.flatMap((r) => (r.account_size ? [r.account_size] : []))),
  ].sort((a, b) => a - b);
  const rewards = shop.data.filter(
    (r) =>
      (!query.firm || r.firm_name === query.firm) &&
      (!query.size || String(r.account_size) === query.size) &&
      (!query.affordable || balance.available >= r.cost_coins),
  );
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="flex items-center gap-3 text-2xl font-bold">
          <TitleIcon icon={Gift} hue="var(--gold)" />
          {t("title")}
        </h1>
        <FrozenNotice />
        <Link
          href="/wallet"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gold/50 bg-gold-soft px-4 shadow-[0_6px_18px_-8px_rgb(255_157_46/0.7)]"
        >
          <CoinCounter value={balance.available} label={t("available")} />
          <span className="text-sm text-text-soft">{t("available")}</span>
        </Link>
      </header>
      <SpinSection />
      {shop.data.length > 0 && (
        <form method="get" className="flex flex-wrap items-end gap-4 rounded-2xl p-4 panel">
          {(
            [
              ["firm", firms],
              ["size", sizes],
            ] as const
          ).map(([k, items]) => (
            <label key={k} className="text-sm">
              {t(k)}
              <select
                className="mt-1 block h-11 rounded-xl border border-hairline bg-ink-deep/60 px-2"
                name={k}
                defaultValue={String(query[k] ?? "")}
              >
                <option value="">{t("any")}</option>
                {items.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              name="affordable"
              value="1"
              defaultChecked={!!query.affordable}
            />
            {t("affordable")}
          </label>
          <button className="min-h-11 rounded-lg border border-hairline px-4 font-semibold hover:bg-raised">
            {t("filter")}
          </button>
        </form>
      )}
      <section aria-labelledby="catalogue" className="space-y-4">
        <h2 id="catalogue" className="text-xl">
          {t("catalogue")}
        </h2>
        {rewards.length ? (
          <ul className="grid gap-x-4 gap-y-6 pt-2 md:grid-cols-2 xl:grid-cols-3">
            {rewards.map((r) => {
              const rarity = r.account_size ? rarityFor(r.account_size) : "common";
              const short = Math.max(0, r.cost_coins - balance.available);
              return (
                <li key={r.id} className="grid">
                  <ItemFrame rarity={rarity} className="flex flex-col gap-3">
                    <RarityTab
                      rarity={rarity}
                      label={
                        r.account_size
                          ? `${c(`rarity.${rarity}`)} · ${sizeLabel(r.account_size)}`
                          : t("boosterTab")
                      }
                    />
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg leading-tight">{r.name}</h3>
                      <CoinCounter
                        value={r.cost_coins}
                        label={t("price")}
                        className="shrink-0 text-lg"
                      />
                    </div>
                    <p className="text-sm text-text-soft">{r.description}</p>
                    {short > 0 ? (
                      <div className="space-y-1">
                        <XpBar
                          value={balance.available}
                          max={r.cost_coins}
                          label={t("progressTo", { name: r.name })}
                          tone="gold"
                          className="h-2.5"
                        />
                        <p className="font-mono tabular text-xs text-muted-foreground">
                          {t("short", { n: short.toLocaleString("en-US") })}
                        </p>
                      </div>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {t(r.kind === "booster" || r.stock > 0 ? "instant" : "queueNote")}
                    </p>
                    {!r.eligible && <p className="text-xs text-caution">{t("ineligible")}</p>}
                    <div className="mt-auto">
                      <RewardControls
                        id={r.id}
                        nonce={randomUUID()}
                        cost={r.cost_coins}
                        goal={r.is_goal}
                        canSpend={balance.available >= r.cost_coins && r.eligible}
                      />
                    </div>
                  </ItemFrame>
                </li>
              );
            })}
          </ul>
        ) : (
          // Empty shop: locked slots stamped, so the shop reads as a shop before stock arrives.
          <div className="space-y-4">
            <ul
              className="grid gap-x-4 gap-y-6 pt-2 md:grid-cols-2 xl:grid-cols-3"
              aria-hidden="true"
            >
              {(["rare", "epic", "legendary"] as const).map((r) => (
                <li key={r} className="grid">
                  <ItemFrame
                    rarity={r}
                    className="flex min-h-44 flex-col items-center justify-center gap-3"
                  >
                    <Lock className="size-7 text-muted-foreground" />
                    <span className="-rotate-6 rounded border-2 border-common/70 px-2 py-0.5 text-[0.6875rem] font-black tracking-[0.14em] text-text-soft uppercase">
                      {t("lockedStamp")}
                    </span>
                  </ItemFrame>
                </li>
              ))}
            </ul>
            <p className="text-text-soft">{t("empty")}</p>
          </div>
        )}
      </section>
      <section aria-labelledby="history" className="space-y-3">
        <h2 id="history" className="text-xl">
          {t("history")}
        </h2>
        {orders.data.length ? (
          <ul className="divide-y divide-hairline rounded-2xl px-4 panel">
            {orders.data.map((d) => (
              <li key={d.id} className="py-4">
                <h3 className="flex flex-wrap items-center gap-2 font-semibold">
                  {d.reward_name}
                  <span
                    className={`-rotate-3 rounded border-2 px-1.5 py-0.5 text-[0.625rem] font-black tracking-[0.12em] uppercase ${d.status === "fulfilled" ? "border-positive/70 text-positive" : d.status === "pending" ? "border-caution/70 text-caution" : "border-common/70 text-muted-foreground"}`}
                  >
                    {t(d.status as "fulfilled" | "pending" | "cancelled")}
                  </span>
                </h3>
                <CoinAmount value={d.cost_coins} size="sm" />
                {d.status === "pending" && (
                  <p>
                    {t("target", { date: d.target_at.slice(0, 16).replace("T", " ") + " UTC" })}
                  </p>
                )}
                {d.status === "fulfilled" && (
                  <p className="mt-2 text-text-soft">{d.instructions}</p>
                )}
                {d.staff_note && <p>{d.staff_note}</p>}
                {codes.has(d.id) && <RevealCode id={d.id} />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">{t("noOrders")}</p>
        )}
      </section>
    </div>
  );
}
