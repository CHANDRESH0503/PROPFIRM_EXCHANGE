import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SessionWordmark } from "@/components/layout/session-links";
import { Skeleton } from "@/components/ui/skeleton";
import { getProfile, requireUser, safeNext } from "@/lib/auth/session";
import { COUNTRY_CODES, countryName } from "@/lib/geo/countries";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Welcome", robots: { index: false, follow: false } };

export default function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl px-5 pt-3 sm:px-8">
        <SessionWordmark />
      </header>
      <main id="main" className="mx-auto w-full max-w-md flex-1 px-5 pt-10 pb-16 sm:pt-16">
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
          <Onboarding searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function Onboarding({ searchParams }: Pick<PageProps<"/onboarding">, "searchParams">) {
  await requireUser("/onboarding");
  const nextParam = (await searchParams).next;
  const next = safeNext(typeof nextParam === "string" ? nextParam : undefined);
  const profile = await getProfile();
  if (profile?.onboarded_at) redirect(next);

  const t = await getTranslations("onboarding");
  const countries = COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <>
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <p className="mt-3 text-text-soft">{t("subtitle")}</p>
      <OnboardingForm countries={countries} next={next} />
    </>
  );
}
