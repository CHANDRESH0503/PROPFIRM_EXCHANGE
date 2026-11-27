import { TitleIcon } from "@/components/layout/title-icon";
import { UserRound } from "lucide-react";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/public-env";
import { createAdminClient } from "@/lib/supabase/admin";
import { ShareLink } from "@/components/waitlist/share-link";
import { countryName } from "@/lib/geo/countries";
import { getRoles, hasRole, requireOnboarded } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <Suspense fallback={<Skeleton className="h-72 w-full rounded-xl" />}>
      <Profile />
    </Suspense>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

async function Profile() {
  const { user, profile } = await requireOnboarded("/profile");
  const db = await createClient();
  const [t, jt, roles, badges, referrals] = await Promise.all([
    getTranslations("profile"),
    getTranslations("journal.badges"),
    getRoles(),
    db
      .from("user_badges")
      .select("badge,awarded_at")
      .eq("user_id", user.id)
      .order("awarded_at", { ascending: false }),
    createAdminClient()
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", user.id),
  ]);
  if (referrals.error) throw new Error("referrals_unavailable");
  const inviteLink = new URL("/sign-in", publicEnv.siteUrl);
  inviteLink.searchParams.set("ref", profile.referral_code);
  if (badges.error) throw new Error("badges_unavailable");
  const awards = badges.data.flatMap(({ badge, awarded_at }) => {
    const streak = /^streak_(\d+)$/.exec(badge);
    const label =
      badge === "founding_member"
        ? t("foundingBadge")
        : badge === "journal_first" || badge === "journal_100"
          ? jt(badge)
          : streak
            ? t("streakBadge", { days: Number(streak[1]) })
            : null;
    return label ? [{ badge, label, awarded_at }] : [];
  });

  const rows: Array<[string, React.ReactNode]> = [
    [t("email"), user.email ?? "—"],
    [t("country"), profile.country_code ? countryName(profile.country_code) : "—"],
    [t("timezone"), profile.timezone ?? "—"],
    [
      t("referralCode"),
      <span key="code" className="font-mono tracking-wider">
        {profile.referral_code}
      </span>,
    ],
    [t("memberSince"), dateFmt.format(new Date(profile.created_at))],
  ];

  return (
    <div className="space-y-8">
      <h1 className="flex items-center gap-3 text-2xl font-bold">
        <TitleIcon icon={UserRound} hue="var(--positive)" />
        {t("title")}
      </h1>
      <dl className="divide-y divide-hairline rounded-2xl panel">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-foreground">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("inviteHeading")}</h2>
        <p className="max-w-prose text-sm text-text-soft">{t("inviteHelp")}</p>
        <ShareLink url={inviteLink.toString()} text={t("inviteText")} label={t("inviteLink")} />
        <p className="text-sm text-muted-foreground">
          {t("invitedCount", { count: referrals.count ?? 0 })}
        </p>
      </section>

      {awards.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t("badges")}</h2>
          <ul className="divide-y divide-hairline">
            {awards.map((a) => (
              <li key={a.badge} className="flex flex-wrap justify-between gap-2 py-3">
                <span>{a.label}</span>
                <time className="text-sm text-muted-foreground" dateTime={a.awarded_at}>
                  {dateFmt.format(new Date(a.awarded_at))}
                </time>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="flex flex-wrap gap-3">
        <Link href="/support" className={buttonVariants({ variant: "secondary" })}>
          {t("support")}
        </Link>
        <Link href="/profile/data" className={buttonVariants({ variant: "secondary" })}>
          {t("data")}
        </Link>
        <Link href="/notifications" className={buttonVariants({ variant: "secondary" })}>
          {t("notifications")}
        </Link>
        <Link href="/wallet" className={buttonVariants({ variant: "secondary" })}>
          {t("wallet")}
        </Link>
        <Link href="/claims" className={buttonVariants({ variant: "secondary" })}>
          {t("claims")}
        </Link>
        {hasRole(roles) ? (
          <Link href="/admin" className={buttonVariants({ variant: "secondary" })}>
            {t("admin")}
          </Link>
        ) : null}
        <form action="/auth/sign-out" method="post">
          <Button type="submit" variant="secondary">
            {t("signOut")}
          </Button>
        </form>
        <form action="/auth/sign-out?scope=global" method="post">
          <Button type="submit" variant="ghost">
            {t("signOutAll")}
          </Button>
        </form>
      </div>
    </div>
  );
}
