"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm, Labelled, inputClass } from "@/components/admin/action-form";
import { NativeSelect } from "@/components/ui/native-select";
import { runDraw, saveDraw, savePrizes } from "./actions";

export type PrizeRow = { label: string; kind: string; value: number; percent: string; cap: string };
const KINDS = ["xp", "xp_boost", "freeze", "ticket"] as const;

export function PrizesForm({ prizes }: { prizes: PrizeRow[] }) {
  const t = useTranslations("adminSpin");
  const [rows, setRows] = useState(
    prizes.length ? prizes : [{ label: "", kind: "xp", value: 10, percent: "100", cap: "" }],
  );
  const total = rows.reduce((s, r) => s + (Number(r.percent) || 0), 0);
  const ok = Math.abs(total - 100) < 1e-9;
  return (
    <ActionForm action={savePrizes} submit={t("savePrizes")}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th scope="col" className="py-2 pr-2 font-medium">
                {t("label")}
              </th>
              <th scope="col" className="py-2 pr-2 font-medium">
                {t("kind")}
              </th>
              <th scope="col" className="py-2 pr-2 font-medium">
                {t("value")}
              </th>
              <th scope="col" className="py-2 pr-2 font-medium">
                {t("odds")}
              </th>
              <th scope="col" className="py-2 font-medium">
                {t("cap")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="py-1 pr-2">
                  <input
                    aria-label={`${t("label")} ${i + 1}`}
                    name={`label_${i}`}
                    defaultValue={r.label}
                    maxLength={60}
                    className={inputClass}
                  />
                </td>
                <td className="py-1 pr-2">
                  <NativeSelect
                    aria-label={`${t("kind")} ${i + 1}`}
                    name={`kind_${i}`}
                    defaultValue={r.kind}
                    className="h-11"
                  >
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {t(`kinds.${k}`)}
                      </option>
                    ))}
                  </NativeSelect>
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label={`${t("value")} ${i + 1}`}
                    name={`value_${i}`}
                    defaultValue={r.value}
                    inputMode="numeric"
                    className={inputClass}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label={`${t("odds")} ${i + 1}`}
                    name={`percent_${i}`}
                    value={r.percent}
                    onChange={(e) =>
                      setRows((list) =>
                        list.map((x, j) => (j === i ? { ...x, percent: e.target.value } : x)),
                      )
                    }
                    inputMode="decimal"
                    className={`${inputClass} font-mono`}
                  />
                </td>
                <td className="py-1">
                  <input
                    aria-label={`${t("cap")} ${i + 1}`}
                    name={`cap_${i}`}
                    defaultValue={r.cap}
                    inputMode="numeric"
                    className={inputClass}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={rows.length >= 12}
          onClick={() =>
            setRows((list) => [
              ...list,
              { label: "", kind: "xp", value: 10, percent: "0", cap: "" },
            ])
          }
          className="inline-flex min-h-11 items-center text-sm underline disabled:opacity-50"
        >
          {t("addRow")}
        </button>
        <p role="status" className={`font-mono text-sm ${ok ? "text-positive" : "text-danger"}`}>
          {t("total", { total: total.toFixed(4).replace(/\.?0+$/, "") })}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">{t("prizeHint")}</p>
      <Labelled label={t("reason")}>
        <input name="reason" required minLength={3} className={inputClass} />
      </Labelled>
    </ActionForm>
  );
}

export function DrawForm({
  draw,
}: {
  draw?: { id: string; title: string; prize: string; starts: string; ends: string; max: number };
}) {
  const t = useTranslations("adminSpin");
  return (
    <ActionForm
      action={saveDraw.bind(null, draw?.id ?? null)}
      submit={draw ? t("saveDraw") : t("createDraw")}
      resetOnSuccess={!draw}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Labelled label={t("drawTitle")}>
          <input
            name="title"
            defaultValue={draw?.title}
            required
            minLength={3}
            maxLength={120}
            className={inputClass}
          />
        </Labelled>
        <Labelled label={t("maxTickets")}>
          <input
            name="max"
            defaultValue={draw?.max ?? 10}
            inputMode="numeric"
            required
            className={inputClass}
          />
        </Labelled>
        <Labelled label={t("starts")}>
          <input
            name="starts"
            type="datetime-local"
            defaultValue={draw?.starts}
            required
            className={inputClass}
          />
        </Labelled>
        <Labelled label={t("ends")}>
          <input
            name="ends"
            type="datetime-local"
            defaultValue={draw?.ends}
            required
            className={inputClass}
          />
        </Labelled>
      </div>
      <Labelled label={t("prize")}>
        <input
          name="prize"
          defaultValue={draw?.prize}
          required
          minLength={3}
          maxLength={300}
          className={inputClass}
        />
      </Labelled>
      {draw ? (
        <label className="flex min-h-11 items-center gap-2 text-sm text-text-soft">
          <input type="checkbox" name="cancel" className="size-4" />
          {t("cancelDraw")}
        </label>
      ) : null}
    </ActionForm>
  );
}

export function RunDraw({ id }: { id: string }) {
  const t = useTranslations("adminSpin");
  return <ActionForm action={runDraw.bind(null, id)} submit={t("run")} variant="danger" />;
}
