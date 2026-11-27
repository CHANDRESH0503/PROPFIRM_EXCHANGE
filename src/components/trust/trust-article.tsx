import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { brand } from "@/config/brand";
import { ScrollText } from "lucide-react";
import { TitleIcon } from "@/components/layout/title-icon";
import type { TrustSlug } from "@/config/nav";

/*
 * Trust and legal pages (07-features.md). Content lives in messages so it can move to the
 * admin content editor later; every page is marked DRAFT until a lawyer reviews it (CLAUDE.md §7).
 */

interface Section {
  heading: string;
  body: string[];
}

const fill = (s: string) =>
  s.replaceAll("{brand}", brand.name).replaceAll("{email}", brand.supportEmail);

export async function trustMetadata(slug: TrustSlug): Promise<Metadata> {
  const t = await getTranslations(`trust.pages.${slug}`);
  return {
    title: t("title"),
    description: fill(t.raw("summary") as string),
    alternates: { canonical: `/${slug}` },
  };
}

export async function TrustArticle({ slug }: { slug: TrustSlug }) {
  const [t, common] = await Promise.all([
    getTranslations(`trust.pages.${slug}`),
    getTranslations("trust"),
  ]);
  const sections = t.raw("sections") as Section[];

  return (
    <article className="mx-auto w-full max-w-[68ch] px-5 pt-8 sm:px-8 sm:pt-16">
      <p
        role="note"
        className="rounded-2xl border border-caution/40 bg-caution/10 px-4 py-3 text-sm text-caution"
      >
        {common("draft")}
      </p>
      <h1 className="mt-8 flex items-center gap-3 text-3xl font-bold sm:text-4xl">
        <TitleIcon icon={ScrollText} hue="var(--violet)" />
        {t("title")}
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-text-soft">
        {fill(t.raw("summary") as string)}
      </p>
      <div className="mt-10 space-y-10 rounded-3xl p-6 panel sm:p-8">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-xl font-semibold">{section.heading}</h2>
            {section.body.map((paragraph, i) => (
              <p key={i} className="mt-3 leading-[1.7] text-text-soft">
                {fill(paragraph)}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
