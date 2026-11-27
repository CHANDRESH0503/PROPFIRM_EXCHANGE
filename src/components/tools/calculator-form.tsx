"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Link2 } from "lucide-react";
import { toast } from "sonner";
import { recordCalculatorUse, submitCalculator } from "@/app/(public)/tools/actions";
import { Button } from "@/components/ui/button";
import { fieldIds } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  calculator,
  defaultContract,
  evaluate,
  fallbackFor,
  type PriceBook,
  pickOption,
  rateNeeded,
  toSearch,
  visibleFields,
  type CalculatorKey,
  type FieldSpec,
  type Values,
} from "@/lib/tools/calculators";
import { instrument, SYMBOLS } from "@/lib/tools/instruments";
import { cn } from "@/lib/utils";
import { formatValue, loose } from "./text";

/** Fixed-zone time so server and client render the same text. */
function asOfTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso));
}

const TONE = { danger: "text-danger", warning: "text-caution", positive: "text-positive" } as const;

/**
 * One form for every calculator. Results update while typing; the form also posts to a Server
 * Action, so it works without JavaScript and the result has a shareable URL.
 */
export function CalculatorForm({
  tool,
  initial,
  fromUrl,
  market,
}: {
  tool: CalculatorKey;
  initial: Values;
  fromUrl: boolean;
  /** Indicative prices, refreshed hourly on the server; null when the price feed is unavailable. */
  market: { prices: PriceBook; asOf: string } | null;
}) {
  const calc = calculator(tool);
  const t = loose(useTranslations("tools"));
  const id = useId();
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [showAll, setShowAll] = useState(fromUrl);
  const [credited, setCredited] = useState(false);
  const [pending, start] = useTransition();
  const edited = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const outcome = useMemo(() => evaluate(calc, values, market?.prices), [calc, values, market]);
  const fields = visibleFields(calc, values);
  const groups = [...new Set(fields.map((f) => f.group))];

  const inst = instrument(pickOption(SYMBOLS, values.symbol));
  const params = {
    symbol: inst.symbol,
    pair: rateNeeded(values) ?? "",
    quote: inst.quote,
    account: values.account ?? "USD",
    size: new Intl.NumberFormat("en-US").format(defaultContract(values)),
  };

  // One mission credit per visit, after the member's own edits give a valid result.
  useEffect(() => {
    if (!edited.current || credited || outcome.status !== "ok") return;
    const timer = window.setTimeout(() => {
      if (!formRef.current) return;
      const data = new FormData(formRef.current);
      start(async () => {
        if ((await recordCalculatorUse(tool, data)) === "recorded") setCredited(true);
      });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [outcome, credited, tool]);

  function update(name: string, value: string) {
    edited.current = true;
    setValues((v) => ({ ...v, [name]: value }));
  }

  function errorFor(f: FieldSpec) {
    if (outcome.status !== "invalid" || !(showAll || touched.has(f.name))) return null;
    const e = outcome.errors[f.name];
    if (!e) return null;
    return e.code === "range"
      ? t(`errors.range`, { min: e.min, max: e.max })
      : t(`errors.${e.code}`);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    // With JavaScript the result is already on screen: keep the page, update the shareable URL.
    event.preventDefault();
    setShowAll(true);
    if (outcome.status === "invalid") {
      const first = fields.find((f) => outcome.errors[f.name]);
      if (first) document.getElementById(`${id}-${first.name}`)?.focus();
      return;
    }
    if (outcome.status !== "ok") return;
    const search = toSearch(calc, values);
    window.history.replaceState(null, "", `${window.location.pathname}?${search}`);
    const data = new FormData(event.currentTarget);
    start(async () => {
      if ((await recordCalculatorUse(tool, data)) === "recorded") setCredited(true);
    });
  }

  async function share() {
    const url = `${window.location.origin}${window.location.pathname}?${toSearch(calc, values)}`;
    try {
      await navigator.clipboard.writeText(url);
      window.history.replaceState(null, "", url);
      toast.success(t("common.copied"));
    } catch {
      toast.error(t("common.copyFailed"));
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
      <form
        ref={formRef}
        action={submitCalculator.bind(null, tool)}
        onSubmit={onSubmit}
        noValidate
        className="space-y-8"
      >
        {groups.map((group) => (
          <fieldset key={group} className="space-y-4">
            {groups.length > 1 ? (
              <legend className="mb-4 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                {t(`groups.${group}`)}
              </legend>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              {fields
                .filter((f) => f.group === group)
                .map((f) => {
                  const fid = `${id}-${f.name}`;
                  const ids = fieldIds(fid);
                  const error = errorFor(f);
                  const hintKey = `${tool}.fields.${f.name}.hint`;
                  const current = values[f.name] ?? "";
                  const fallback = current.trim()
                    ? undefined
                    : fallbackFor(f.name, values, market?.prices);
                  const hint =
                    fallback !== undefined && market
                      ? t("common.indicative", { price: fallback, time: asOfTime(market.asOf) })
                      : t.has(hintKey)
                        ? t(hintKey, params)
                        : null;
                  const describedBy = error ? ids.error : hint ? ids.hint : undefined;
                  return (
                    <div key={f.name} className="space-y-2">
                      <label htmlFor={fid} className="block text-sm font-medium text-text-soft">
                        {t(`${tool}.fields.${f.name}.label`, params)}
                      </label>
                      {f.kind === "select" ? (
                        <NativeSelect
                          id={fid}
                          name={f.name}
                          value={f.options.includes(current) ? current : f.options[0]}
                          onChange={(e) => update(f.name, e.target.value)}
                        >
                          {f.options.map((o) => (
                            <option key={o} value={o}>
                              {f.literal ? o : t(`options.${f.name}.${o}`)}
                            </option>
                          ))}
                        </NativeSelect>
                      ) : (
                        <Input
                          id={fid}
                          name={f.name}
                          type={f.kind === "date" ? "date" : "text"}
                          inputMode={f.kind === "date" ? undefined : f.signed ? "text" : "decimal"}
                          autoComplete="off"
                          spellCheck={false}
                          maxLength={f.kind === "date" ? undefined : 20}
                          value={current}
                          placeholder={fallback !== undefined ? String(fallback) : undefined}
                          onChange={(e) => update(f.name, e.target.value)}
                          onBlur={() => setTouched((s) => new Set(s).add(f.name))}
                          aria-invalid={error ? true : undefined}
                          aria-describedby={describedBy}
                          className="font-mono tabular"
                        />
                      )}
                      {hint && !error ? (
                        <p id={ids.hint} className="text-xs leading-relaxed text-muted-foreground">
                          {hint}
                        </p>
                      ) : null}
                      <p
                        id={ids.error}
                        aria-live="polite"
                        className={cn("text-sm text-danger", !error && "sr-only")}
                      >
                        {error ?? ""}
                      </p>
                    </div>
                  );
                })}
            </div>
          </fieldset>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" pending={pending}>
            {t("common.calculate")}
          </Button>
          <p className="text-sm text-muted-foreground">{t("common.live")}</p>
        </div>
      </form>

      <section
        aria-labelledby={`${id}-result`}
        className="rounded-3xl p-5 frame-brand lg:sticky lg:top-24"
      >
        <h2 id={`${id}-result`} className="font-heading text-base font-semibold">
          {t("common.results")}
        </h2>
        <div aria-live="polite" className="mt-4">
          {outcome.status === "ok" ? (
            <>
              <dl className="divide-y divide-hairline">
                {outcome.rows.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-baseline justify-between gap-4 py-3 first:pt-0"
                  >
                    <dt className="text-sm text-text-soft">{t(`${tool}.rows.${row.key}`)}</dt>
                    <dd
                      className={cn(
                        "text-right font-mono tabular",
                        row.emphasis ? "text-xl font-semibold" : "text-sm",
                        row.tone && TONE[row.tone],
                      )}
                    >
                      {formatValue(row.value, row.format, outcome.currency, row.precise)}
                    </dd>
                  </div>
                ))}
              </dl>
              {outcome.notes.length ? (
                <ul className="mt-4 space-y-2">
                  {outcome.notes.map((note) => (
                    <li key={note.key} className={cn("text-sm leading-relaxed", TONE[note.tone])}>
                      {t(
                        `${tool}.notes.${note.key}`,
                        Object.fromEntries(
                          Object.entries(note.params ?? {}).map(([k, v]) => [
                            k,
                            typeof v === "number"
                              ? formatValue(v, note.format ?? "money", outcome.currency)
                              : v,
                          ]),
                        ),
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
                <Button type="button" variant="secondary" size="sm" onClick={share}>
                  <Link2 aria-hidden="true" />
                  {t("common.share")}
                </Button>
                {credited ? (
                  <p className="inline-flex items-center gap-1.5 text-sm text-positive">
                    <Check className="size-4" aria-hidden="true" />
                    {t("common.credited")}
                  </p>
                ) : null}
              </div>
            </>
          ) : outcome.status === "invalid" && showAll ? (
            <p className="text-sm text-danger">{t("common.fixErrors")}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
          )}
        </div>
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">{t("common.estimate")}</p>
      </section>
    </div>
  );
}
