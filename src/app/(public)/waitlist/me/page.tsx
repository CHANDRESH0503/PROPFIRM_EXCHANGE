import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CheckCircle2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ShareLink } from "@/components/waitlist/share-link";
import { brand } from "@/config/brand";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/public-env";
import { currentWaitlistMember } from "@/lib/waitlist";

export const metadata: Metadata = { title: "Your place", robots: { index: false, follow: false } };

export default async function WaitlistMePage() {
  const t = await getTranslations("waitlist.me");
  return (
    <div className="mx-auto w-full max-w-[62ch] px-5 pt-8 sm:px-8 sm:pt-16">
      <h1 className="text-3xl font-bold sm:text-4xl">{t("title")}</h1>
      <Suspense fallback={<MemberSkeleton />}>
        <Member />
      </Suspense>
    </div>
  );
}

async function boost(): Promise<number> {
  const { data } = await createAdminClient().from("site_settings").select("value").eq("key", "waitlist.referral_boost").maybeSingle();
  return typeof data?.value === "number" ? data.value : 5;
}

const fmt = new Intl.NumberFormat("en-US");

async function Member() {
  const t = await getTranslations("waitlist.me");
  // The cookie read comes first: it makes this subtree request-time, so the settings read
  // below never runs during the build.
  const member = await currentWaitlistMember();

  if (!member) {
    return (
      <div className="mt-8 space-y-4">
        <p className="font-heading text-lg font-semibold">{t("notFoundTitle")}</p>
        <p className="text-text-soft">{t("notFoundBody")}</p>
        <Link href="/" className={buttonVariants({ variant: "primary", size: "lg" })}>
          {t("join")}
        </Link>
      </div>
    );
  }

  const places = await boost();
  const link = new URL("/", publicEnv.siteUrl);
  link.searchParams.set("ref", member.referralCode);
  const digits = String(member.position ?? 0).padStart(4, "0").split("");

  return (
    <div className="mt-6 space-y-10">
      <p className="flex items-center gap-2 text-positive">
        <CheckCircle2 className="size-5" aria-hidden="true" />
        <span>{t("confirmed")}</span>
      </p>

      <section aria-labelledby="place" className="rounded-xl border border-hairline bg-surface p-5 sm:p-6">
        <h2 id="place" className="text-sm font-medium text-muted-foreground">
          {t("position")}
        </h2>
        <p className="mt-3 flex items-end gap-3">
          <span className="sr-only">{fmt.format(member.position ?? 0)}</span>
          <span aria-hidden="true" className="flex gap-1.5 font-mono">
            {digits.map((d, i) => (
              <span
                key={i}
                className="grid h-16 w-12 place-items-center rounded-lg border border-hairline bg-ink text-4xl font-semibold text-foreground sm:h-20 sm:w-14 sm:text-5xl"
              >
                {d}
              </span>
            ))}
          </span>
          <span className="pb-1 text-sm text-muted-foreground">{t("of", { total: fmt.format(member.totalConfirmed) })}</span>
        </p>
        <p className="mt-5 text-text-soft">{t("referrals", { count: member.confirmedReferrals })}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("boost", { boost: places })}</p>
      </section>

      <section aria-labelledby="share" className="space-y-3">
        <h2 id="share" className="text-xl font-semibold">
          {t("shareHeading")}
        </h2>
        <ShareLink url={link.toString()} text={t("shareText", { brand: brand.name })} />
      </section>

      <p className="text-sm text-muted-foreground">{t("next")}</p>
    </div>
  );
}

function MemberSkeleton() {
  return (
    <div className="mt-6 space-y-6" aria-hidden="true">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
