import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/auth/session";
import { currentEconomy } from "@/lib/economy/config";
import { Skeleton } from "@/components/ui/skeleton";
import { EconomyForm } from "./economy-form";
export const metadata = { title: "Economy settings" };
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-72" />}>
      <Settings />
    </Suspense>
  );
}
async function Settings() {
  await requireStaff("owner");
  const [config, t] = await Promise.all([currentEconomy(), getTranslations("rates")]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="max-w-prose text-text-soft">{t("version", { version: config.version })}</p>
      <EconomyForm config={config} />
    </div>
  );
}
