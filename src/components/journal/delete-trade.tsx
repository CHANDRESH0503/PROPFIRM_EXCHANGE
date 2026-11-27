"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { deleteTrade } from "@/app/(app)/(shell)/accounts/actions";
import { Button } from "@/components/ui/button";

/** Two-step delete in the page (no browser dialog). */
export function DeleteTrade({ tradeId }: { tradeId: string }) {
  const t = useTranslations("journal");
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!confirming) {
    return (
      <Button variant="danger" onClick={() => setConfirming(true)}>
        {t("detail.delete")}
      </Button>
    );
  }
  return (
    <div
      role="group"
      aria-label={t("detail.delete")}
      className="space-y-3 rounded-lg border border-danger/40 p-4"
    >
      <p className="text-sm">{t("detail.deleteConfirm")}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="danger"
          pending={pending}
          onClick={() =>
            start(async () => {
              const r = await deleteTrade(tradeId);
              if (r?.status === "error") setFailed(t(`errors.${r.code}`));
            })
          }
        >
          {t("detail.deleteYes")}
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
          {t("detail.cancel")}
        </Button>
      </div>
      {failed ? (
        <p role="alert" className="text-sm text-danger">
          {failed}
        </p>
      ) : null}
    </div>
  );
}
