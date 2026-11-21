import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { brand } from "@/config/brand";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function SignInPage() {
  const t = await getTranslations("auth");
  return (
    <>
      <h1 className="text-3xl font-bold">{t("title", { brand: brand.name })}</h1>
      <p className="mt-3 text-text-soft">{t("subtitle")}</p>
      <Suspense fallback={<Skeleton className="mt-8 h-56 w-full rounded-xl" />}>
        <SignInForm />
      </Suspense>
      <p className="mt-8 text-sm text-muted-foreground">{t("adultsOnly", { brand: brand.name })}</p>
    </>
  );
}
