"use client";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { COUNTRY_CODES, countryName } from "@/lib/geo/countries";

export function DealSheet({
  program,
  name,
  code,
  needsCountry,
  guest,
  eligible,
}: {
  program: string;
  name: string;
  code: string | null;
  needsCountry: boolean;
  guest: boolean;
  eligible: boolean;
}) {
  const t = useTranslations("purchase");
  const [copied, setCopied] = useState(false);
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" block>
          {t("get")}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[90dvh] max-w-xl overflow-y-auto p-6 pb-8"
      >
        <SheetTitle className="pr-10 text-xl">{name}</SheetTitle>
        <SheetDescription>{t("disclosure")}</SheetDescription>
        {code && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-hairline p-3">
            <code>{code}</code>
            <Button
              variant="ghost"
              type="button"
              onClick={() =>
                navigator.clipboard
                  ?.writeText(code)
                  .then(() => setCopied(true))
                  .catch(() => setCopied(false))
              }
            >
              {t(copied ? "copied" : "copy")}
            </Button>
          </div>
        )}
        <p>{t("buy")}</p>
        {eligible && (
          <p>
            <Link className="underline" href={`/claims?program=${program}`}>
              {t("claimAfter")}
            </Link>
          </p>
        )}
        {guest && eligible && (
          <Link
            className="underline"
            href={`/sign-in?next=${encodeURIComponent("/claims?program=" + program)}`}
          >
            {t("signIn")}
          </Link>
        )}
        <form action="/go" method="post" target="_blank" rel="noopener" className="space-y-4">
          <input type="hidden" name="program" value={program} />
          {needsCountry && (
            <label className="block">
              {t("country")}
              <select
                required
                defaultValue=""
                name="country"
                className="mt-1 h-12 w-full rounded-xl border border-hairline bg-ink-deep/60 px-3"
              >
                <option disabled value="">
                  {t("choose")}
                </option>
                {COUNTRY_CODES.map((c) => (
                  <option value={c} key={c}>
                    {countryName(c)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button block>{t("continue")}</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
