"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { noTradesToday } from "@/app/(app)/(shell)/accounts/actions";
import { Button } from "@/components/ui/button";

export function NoTradesButton({ marked }: { marked: "trade" | "no_trades" | null }) {
  const t = useTranslations("journal.today");
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  if (marked) {
    return (
      <p className="inline-flex min-h-11 items-center gap-1.5 text-sm text-positive">
        <Check className="size-4" aria-hidden="true" />
        {marked === "no_trades" ? t("noTradesDone") : t("logged")}
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <Button
        variant="secondary"
        pending={pending}
        onClick={() =>
          start(async () => {
            const result = await noTradesToday();
            setFailed(result?.status === "error");
          })
        }
      >
        {t("noTrades")}
      </Button>
      {failed ? (
        <p role="alert" className="text-sm text-danger">
          {t("failed")}
        </p>
      ) : null}
    </div>
  );
}
