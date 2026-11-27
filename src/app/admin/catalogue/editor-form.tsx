"use client";
import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { assets, kinds } from "@/lib/catalogue/editor";
import { saveCatalogue } from "./actions";

export type Kind = (typeof kinds)[number];
export type FormValues = Record<string, string | number | boolean | string[] | null>;
type Choice = { id: string; name: string };
const fieldKeys = {
  firm: [
    "name",
    "slug",
    "description",
    "platforms",
    "status",
    "status_note",
    "logo_url",
    "published_at",
    "tracking_url",
    "promo_code",
    "commission_bps",
    "rebate_permission",
    "evidence_url",
  ],
  program: [
    "name",
    "account_size",
    "steps",
    "list_price_cents",
    "currency",
    "profit_target_bps",
    "daily_loss_bps",
    "max_loss_bps",
    "profit_split_bps",
    "drawdown_type",
    "payout_frequency",
    "rules",
    "published_at",
  ],
  offer: [
    "title",
    "terms",
    "code",
    "discount_bps",
    "starts_at",
    "ends_at",
    "exclusive",
    "published",
  ],
} as const;
export function EditorForm({
  kind,
  values,
  programs,
}: {
  kind: Kind;
  values: FormValues;
  programs: Choice[];
}) {
  const t = useTranslations("editor");
  const [result, action, pending] = useActionState(saveCatalogue, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (result?.field)
      form.current?.querySelector<HTMLElement>(`[name="${CSS.escape(result.field)}"]`)?.focus();
  }, [result]);
  const control =
    "mt-1 block min-h-11 w-full rounded-xl border border-hairline bg-ink-deep/60 px-3 py-2";
  const field = (key: string) => {
    const v = values[key];
    const label = t(`fields.${key}` as Parameters<typeof t>[0]);
    const props = {
      name: key,
      "aria-invalid": result?.field === key || undefined,
      "aria-describedby": result?.field === key ? "editor-error" : undefined,
    };
    if (["rebate_permission", "exclusive", "published"].includes(key))
      return (
        <label key={key} className="flex min-h-11 items-center gap-2">
          <input type="checkbox" {...props} defaultChecked={v === true} />
          {label}
        </label>
      );
    const choices =
      key === "status"
        ? ["active", "watch", "delisted"]
        : key === "drawdown_type"
          ? ["static", "trailing", "end_of_day"]
          : null;
    const type = key.endsWith("_at")
      ? "datetime-local"
      : key.endsWith("_url")
        ? "url"
        : key.endsWith("_bps") || ["steps", "account_size", "list_price_cents"].includes(key)
          ? "number"
          : "text";
    const value =
      type === "datetime-local" && typeof v === "string"
        ? new Date(v).toISOString().slice(0, 19)
        : String(v ?? "");
    return (
      <label key={key} className="block text-sm">
        {label}
        {choices ? (
          <select {...props} className={control} defaultValue={value}>
            {choices.map((c) => (
              <option key={c} value={c}>
                {t(`choice.${c}` as Parameters<typeof t>[0])}
              </option>
            ))}
          </select>
        ) : ["rules", "description", "terms", "status_note", "change_summary"].includes(key) ? (
          <textarea {...props} className={control} defaultValue={value} />
        ) : (
          <input
            {...props}
            className={control}
            type={type}
            defaultValue={value}
            step={type === "datetime-local" ? "1" : undefined}
            min={type === "number" ? 0 : undefined}
            required={[
              "name",
              "slug",
              "title",
              "code",
              "commission_bps",
              "discount_bps",
              "account_size",
              "list_price_cents",
              "currency",
              "steps",
              "reason",
              "starts_at",
              "ends_at",
              "payout_frequency",
            ].includes(key)}
          />
        )}
      </label>
    );
  };
  const multiselect = kind === "firm" ? "asset_classes" : "program_ids";
  return (
    <form action={action} ref={form} className="space-y-6">
      {["id", "revision", "firm_id"].map((k) => (
        <input
          key={k}
          type="hidden"
          name={k}
          value={String(values[k] ?? (k === "revision" ? 0 : ""))}
        />
      ))}
      <input type="hidden" name="kind" value={kind} />
      <div className="grid gap-4 sm:grid-cols-2">{fieldKeys[kind].map(field)}</div>
      {kind !== "program" && (
        <fieldset className="border-y border-hairline py-3">
          <legend>{t(kind === "firm" ? "asset_classes" : "program_ids")}</legend>
          <div className="flex flex-wrap gap-x-5">
            {(kind === "firm"
              ? assets.map((v) => ({ id: v, name: v.toUpperCase() }))
              : programs
            ).map((c) => (
              <label key={c.id} className="inline-flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  name={multiselect}
                  value={c.id}
                  defaultChecked={
                    Array.isArray(values[multiselect]) && values[multiselect].includes(c.id)
                  }
                />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <details>
        <summary className="cursor-pointer py-3">{t("publicChange")}</summary>
        <div className="grid gap-4">
          {field("change_summary")}
          {field("source_url")}
        </div>
      </details>
      {field("reason")}
      {result && (
        <p id="editor-error" role="alert" className="text-danger">
          {t(result.code, {
            field: result.field ? t(`fields.${result.field}` as Parameters<typeof t>[0]) : "",
          })}
        </p>
      )}
      <Button pending={pending}>{t(pending ? "saving" : "save")}</Button>
    </form>
  );
}
