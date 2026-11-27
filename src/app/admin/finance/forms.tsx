"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { parseCommissionCsv, type ReportMapping } from "@/lib/economy/report";
import { importReport, decideCommission, markPaid } from "./actions";
const control =
  "mt-1 block min-h-11 w-full rounded-xl border border-hairline bg-ink-deep/60 px-3 py-2";
export function ReportForm({
  firms,
}: {
  firms: { id: string; name: string; mapping: ReportMapping | null }[];
}) {
  const t = useTranslations("finance");
  const [state, action, pending] = useActionState(importReport, "");
  const [columns, setColumns] = useState<string[]>([]);
  const [parseError, setParseError] = useState(false);
  const [firm, setFirm] = useState(firms[0]?.id ?? "");
  const previous = firms.find((f) => f.id === firm)?.mapping;
  return (
    <form action={action} className="max-w-xl space-y-4">
      <label className="block">
        {t("firm")}
        <select
          className={control}
          name="firm"
          required
          value={firm}
          onChange={(e) => setFirm(e.target.value)}
        >
          {firms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        {t("file")}
        <input
          className={control}
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          onChange={async (e) => {
            const file = e.target.files?.[0];
            setColumns([]);
            setParseError(false);
            if (!file) return;
            try {
              if (file.size > 500000) throw new Error("size");
              setColumns(parseCommissionCsv(await file.text()).header);
            } catch {
              setParseError(true);
            }
          }}
        />
      </label>
      {parseError && (
        <p role="alert" className="text-danger">
          {t("invalid")}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {(["external", "order", "amount"] as const).map((k) => (
          <label key={k}>
            {t(k)}
            <select
              className={control}
              key={firm + JSON.stringify(columns)}
              required
              name={k}
              defaultValue={previous?.[k] ?? ""}
            >
              <option value="">{t("select")}</option>
              {columns.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <label className="block">
        {t("reason")}
        <input className={control} name="reason" required minLength={3} maxLength={1000} />
      </label>
      <Button pending={pending} disabled={!columns.length}>
        {t("import")}
      </Button>
      {state && (
        <p role="status">{t(state as "imported" | "invalid" | "limited" | "importError")}</p>
      )}
    </form>
  );
}
export function DecisionForm({
  id,
  confirmable,
  canReverse,
}: {
  id: string;
  confirmable: boolean;
  canReverse: boolean;
}) {
  const t = useTranslations("finance");
  const [state, action, pending] = useActionState(decideCommission, "");
  return (
    <form action={action} className="space-y-3 py-3">
      <input type="hidden" name="id" value={id} />
      <label>
        {t("reason")}
        <input className={control} name="reason" required minLength={3} maxLength={1000} />
      </label>
      {state === "capRequired" && (
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" name="cap_reviewed" />
          {t("capReview")}
        </label>
      )}
      <div className="flex flex-wrap gap-3">
        {confirmable && (
          <Button pending={pending} name="decision" value="confirm">
            {t("confirm")}
          </Button>
        )}
        {canReverse && (
          <Button pending={pending} variant="secondary" name="decision" value="reverse">
            {t("reverse")}
          </Button>
        )}
      </div>
      {state && (
        <p role="status">
          {t(state as "saved" | "limited" | "capRequired" | "invalid" | "decisionError")}
        </p>
      )}
    </form>
  );
}

/**
 * Mark-paid form. The checkboxes live on each commission row and join this form through the
 * `form` attribute, so the list keeps one decision form per row.
 */
export function PaidForm({ today }: { today: string }) {
  const t = useTranslations("finance");
  const [state, action, pending] = useActionState(markPaid, "");
  return (
    <form
      id="mark-paid"
      action={action}
      className="grid gap-3 rounded-2xl p-4 panel sm:grid-cols-3"
    >
      <p className="text-sm text-text-soft sm:col-span-3">{t("paidHelp")}</p>
      <label>
        {t("paidReference")}
        <input className={control} name="reference" required maxLength={160} />
      </label>
      <label>
        {t("paidOn")}
        <input
          className={control}
          name="paid_on"
          type="date"
          required
          max={today}
          defaultValue={today}
        />
      </label>
      <label>
        {t("reason")}
        <input className={control} name="reason" required minLength={3} maxLength={1000} />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <Button pending={pending}>{t("markPaid")}</Button>
        {state && (
          <p role="status">{t(state as "paidSaved" | "paidInvalid" | "paidError" | "limited")}</p>
        )}
      </div>
    </form>
  );
}
