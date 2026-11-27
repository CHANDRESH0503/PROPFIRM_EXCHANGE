"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { reviewClaim } from "./actions";
export function ReviewForm({ id }: { id: string }) {
  const t = useTranslations("purchase");
  const [state, action, pending] = useActionState(reviewClaim, "");
  return (
    <form action={action} className="grid max-w-lg gap-3 py-4">
      <input type="hidden" name="id" value={id} />
      <label>
        {t("decision")}
        <select
          className="mt-1 block h-11 w-full rounded-xl border border-hairline bg-ink-deep/60 px-3"
          name="decision"
          required
          defaultValue=""
        >
          <option disabled value="">
            {t("choose")}
          </option>
          {(["approved", "rejected", "needs_info", "flagged"] as const).map((k) => (
            <option key={k} value={k}>
              {t(`status.${k}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("note")}
        <textarea
          name="reason"
          className="mt-1 block w-full rounded-xl border border-hairline bg-ink-deep/60 p-2"
          required
          minLength={3}
          maxLength={1000}
        />
      </label>
      <Button pending={pending}>{t("save")}</Button>
      {state && (
        <p role="status">{t(state as "limited" | "invalid" | "saved" | "stale" | "unavailable")}</p>
      )}
    </form>
  );
}
