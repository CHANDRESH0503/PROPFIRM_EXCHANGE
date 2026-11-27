import { getTranslations } from "next-intl/server";
import { HomeLink } from "@/components/layout/session-links";
import { buttonVariants } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <main id="main" className="mx-auto max-w-md px-5 py-24">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="mt-2 text-2xl font-bold">{t("notFoundTitle")}</h1>
      <p className="mt-3 text-text-soft">{t("notFoundBody")}</p>
      <HomeLink home={t("home")} app={t("app")} className={buttonVariants({ className: "mt-6" })} />
    </main>
  );
}
