import { TitleIcon } from "@/components/layout/title-icon";
import { Wrench } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ToolDirectory } from "@/components/tools/tool-directory";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tools.index");
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: { canonical: "/tools" },
  };
}

export default async function ToolsIndex() {
  const [t, common] = await Promise.all([
    getTranslations("tools.index"),
    getTranslations("tools.common"),
  ]);
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
      <header className="max-w-prose space-y-3">
        <h1 className="flex items-center gap-3 font-heading text-3xl font-bold">
          <TitleIcon icon={Wrench} hue="var(--cyan)" />
          {t("title")}
        </h1>
        <p className="text-text-soft">{t("intro")}</p>
      </header>
      <ToolDirectory journal className="mt-10" />
      <p className="mt-10 max-w-prose text-sm leading-relaxed text-muted-foreground">
        {common("noAdvice")}
      </p>
    </div>
  );
}
