"use client";

import { useTranslations } from "next-intl";
import { ActionForm, Labelled, inputClass } from "@/components/admin/action-form";
import { saveBudget } from "../users/actions";

export type Budget = {
  id: string;
  name: string;
  purpose: string;
  cap: number;
  ends: string;
  active: boolean;
};

export function BudgetForm({ budget }: { budget?: Budget }) {
  const t = useTranslations("campaigns");
  return (
    <ActionForm
      action={saveBudget.bind(null, budget?.id ?? null)}
      submit={budget ? t("update") : t("create")}
      resetOnSuccess={!budget}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Labelled label={t("name")}>
          <input
            name="name"
            defaultValue={budget?.name}
            required
            minLength={3}
            maxLength={120}
            className={inputClass}
          />
        </Labelled>
        <Labelled label={t("cap")}>
          <input
            name="cap"
            inputMode="numeric"
            defaultValue={budget?.cap}
            required
            className={inputClass}
          />
        </Labelled>
        <Labelled label={t("purpose")}>
          <input
            name="purpose"
            defaultValue={budget?.purpose}
            required
            minLength={3}
            maxLength={500}
            className={inputClass}
          />
        </Labelled>
        <Labelled label={t("ends")}>
          <input
            name="ends"
            type="datetime-local"
            defaultValue={budget?.ends}
            className={inputClass}
          />
        </Labelled>
        <Labelled label={t("reason")}>
          <input name="reason" required minLength={3} className={inputClass} />
        </Labelled>
        <label className="flex min-h-11 items-center gap-2 self-end text-sm text-text-soft">
          <input
            type="checkbox"
            name="active"
            defaultChecked={budget?.active ?? true}
            className="size-4"
          />
          {t("active")}
        </label>
      </div>
    </ActionForm>
  );
}
