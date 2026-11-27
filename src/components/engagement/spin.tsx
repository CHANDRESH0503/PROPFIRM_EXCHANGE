"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { spinWheel } from "./spin-actions";

/** Daily spin with its odds beside it (CLAUDE.md §2.9: odds are always published). */
export function DailySpin({
  spunToday,
  lastPrize,
  odds,
}: {
  spunToday: boolean;
  lastPrize: string | null;
  odds: { label: string; percent: string }[];
}) {
  const t = useTranslations("spin");
  const r = useTranslations("results");
  const [pending, start] = useTransition();
  const [prize, setPrize] = useState<string | null>(spunToday ? lastPrize : null);
  const [error, setError] = useState<string | null>(null);
  return (
    <section
      aria-labelledby="daily-spin"
      className="grid gap-6 rounded-2xl p-5 panel md:grid-cols-[1fr_16rem]"
    >
      <div className="space-y-3">
        <h2 id="daily-spin" className="font-heading text-lg font-semibold">
          {t("title")}
        </h2>
        <p className="text-sm text-text-soft">{t("intro")}</p>
        {prize ? (
          <p role="status" className="text-lg font-semibold">
            {t("won", { prize })}
          </p>
        ) : (
          <Button
            pending={pending}
            onClick={() =>
              start(async () => {
                const result = await spinWheel();
                if (result.ok && result.prize) setPrize(result.prize);
                else if (!result.ok) setError(r(result.key));
              })
            }
          >
            {t("spin")}
          </Button>
        )}
        {prize ? <p className="text-sm text-muted-foreground">{t("again")}</p> : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">{t("fine")}</p>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium text-text-soft">{t("odds")}</h3>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-hairline">
            {odds.map((o) => (
              <tr key={o.label}>
                <th scope="row" className="py-1.5 text-left font-normal">
                  {o.label}
                </th>
                <td className="py-1.5 text-right font-mono tabular">{o.percent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
