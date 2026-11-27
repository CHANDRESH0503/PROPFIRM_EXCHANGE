import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CoinCounter, LevelBadge, XpBar } from "@/components/game/progress";
import { getProfile } from "@/lib/auth/session";
import { walletBalance } from "@/lib/economy/wallet";
import { createAdminClient } from "@/lib/supabase/admin";

/** Header player bar: level badge, XP toward the next level, and available Coins. */
export function PlayerBar() {
  return (
    <Suspense
      fallback={
        <span className="h-8 w-40 animate-pulse rounded-full bg-raised" aria-hidden="true" />
      }
    >
      <Bar />
    </Suspense>
  );
}

async function Bar() {
  const profile = await getProfile();
  if (!profile?.onboarded_at) return null;
  const [t, progress, balance] = await Promise.all([
    getTranslations("today"),
    createAdminClient().rpc("trader_progress", { p_user: profile.id }).maybeSingle(),
    walletBalance(profile.id),
  ]);
  if (!progress.data) return null;
  const { xp, next_xp: target, level_name: level, tier } = progress.data;
  return (
    <div className="flex items-center gap-3">
      <Link
        href="/today"
        className="flex items-center gap-2 rounded-full border border-xp/40 bg-xp/12 py-1 pr-3 pl-1"
        aria-label={t("level.title")}
      >
        <LevelBadge tier={tier} name={level} className="size-7 text-xs" />
        <XpBar
          value={xp}
          max={target ?? Math.max(xp, 1)}
          label={t("level.headerRing")}
          animateKey="fb:header-xp"
          className="h-2 w-14 sm:w-24"
        />
      </Link>
      <Link
        href="/wallet"
        className="inline-flex min-h-10 items-center rounded-full border border-gold/50 bg-gold-soft px-3 shadow-[0_4px_14px_-6px_rgb(255_157_46/0.6)]"
        aria-label={t("wallet.title")}
      >
        <CoinCounter
          value={balance.available}
          label={t("wallet.available")}
          countKey="fb:header-coins"
          className="text-sm"
        />
      </Link>
    </div>
  );
}
