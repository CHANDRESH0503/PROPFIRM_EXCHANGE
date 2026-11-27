import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AccountLink } from "@/components/layout/session-links";
import { buttonVariants } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("journal.landing");
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: { canonical: "/journal" },
  };
}

/**
 * Landing page for the journal campaign (`/journal?ref=journal-reel`). Static; the call to
 * action resolves in the browser so signed-in members go straight to their journal.
 */
export default async function JournalLanding() {
  const t = await getTranslations("journal.landing");
  const raw = t.raw("features");
  const features = Array.isArray(raw)
    ? raw.flatMap((f: unknown) =>
        f &&
        typeof f === "object" &&
        "title" in f &&
        "body" in f &&
        typeof f.title === "string" &&
        typeof f.body === "string"
          ? [{ title: f.title, body: f.body }]
          : [],
      )
    : [];
  return (
    <article className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8 md:py-20">
      <header className="max-w-2xl space-y-5">
        <h1 className="font-heading text-4xl leading-tight font-bold text-balance md:text-5xl">
          {t("title")}
        </h1>
        <p className="text-lg leading-relaxed text-text-soft">{t("lead")}</p>
        <AccountLink
          signIn={t("cta")}
          openApp={t("signedIn")}
          signedInHref="/accounts"
          signedOutHref="/sign-in?next=%2Faccounts%2Ftrades%2Fnew"
          className={buttonVariants({ size: "lg" })}
        />
      </header>
      <ul className="mt-16 grid gap-px overflow-hidden rounded-xl border border-hairline bg-hairline sm:grid-cols-2">
        {features.map((f) => (
          <li key={f.title} className="space-y-2 bg-surface p-6">
            <h2 className="font-heading text-lg font-semibold">{f.title}</h2>
            <p className="leading-relaxed text-text-soft">{f.body}</p>
          </li>
        ))}
      </ul>
      <p className="mt-10 max-w-prose text-sm leading-relaxed text-muted-foreground">
        {t("honest")}
      </p>
    </article>
  );
}
