import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { getRestriction, getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Account restricted",
  robots: { index: false, follow: false },
};

export default function RestrictedPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
      <Restricted />
    </Suspense>
  );
}

async function Restricted() {
  const [t, user, restriction] = await Promise.all([
    getTranslations("restricted"),
    getSessionUser(),
    getRestriction(),
  ]);
  const level = restriction?.level ?? null;
  return (
    <div className="space-y-5">
      <h1 className="font-heading text-2xl font-bold">
        {level === "banned" ? t("bannedTitle") : t("suspendedTitle")}
      </h1>
      <p className="text-text-soft">
        {level === "banned"
          ? t("bannedBody")
          : level === "suspended"
            ? t("suspendedBody")
            : t("clearBody")}
      </p>
      {restriction?.member_message ? (
        <p className="rounded-xl border border-hairline bg-ink-deep/60 p-4 text-sm">
          {restriction.member_message}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">{t("help")}</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/help" className="inline-flex min-h-11 items-center underline">
          {t("helpLink")}
        </Link>
        {user ? (
          <form action="/auth/sign-out" method="post">
            <button className="inline-flex min-h-11 items-center underline">{t("signOut")}</button>
          </form>
        ) : null}
        {!level ? (
          <Link href="/today" className="inline-flex min-h-11 items-center underline">
            {t("continue")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
