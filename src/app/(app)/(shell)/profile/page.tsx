import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

async function Profile() {
  const { user, profile } = await requireOnboarded("/profile");
  const [t, roles] = await Promise.all([getTranslations("profile"), getRoles()]);

  const rows: Array<[string, React.ReactNode]> = [
    [t("email"), user.email ?? "—"],
    [t("country"), profile.country_code ? countryName(profile.country_code) : "—"],
    [t("timezone"), profile.timezone ?? "—"],
    [t("referralCode"), <span key="code" className="font-mono tracking-wider">{profile.referral_code}</span>],
    [t("memberSince"), dateFmt.format(new Date(profile.created_at))],
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <dl className="divide-y divide-hairline rounded-xl border border-hairline bg-surface">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-foreground">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-3">
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
