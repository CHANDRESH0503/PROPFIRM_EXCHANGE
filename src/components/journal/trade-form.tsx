"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { saveTrade, type JournalState } from "@/app/(app)/(shell)/accounts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { Strategy, Tag } from "@/lib/journal/data";
import { ACCOUNT_CURRENCIES } from "@/lib/tools/instruments";
import { cn } from "@/lib/utils";

export type TradeDefaults = {
  symbol: string;
  direction: "long" | "short";
  opened: string;
  closed: string;
  lots: string;
  entry: string;
  exit: string;
  stopLoss: string;
  takeProfit: string;
  currency: string;
  result: string;
  commission: string;
  swap: string;
  strategy: string;
  emotionBefore: string;
  emotionAfter: string;
  confidence: string;
  notes: string;
  tags: string[];
  rules: Record<string, "followed" | "broken">;
};

const label = "block text-sm text-text-soft";

type A11y = { id: string; "aria-describedby"?: string; "aria-invalid"?: true };

/** Label, control and hint linked by id, so the accessible name is just the label text. */
function Labelled({
  id,
  text,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  text: string;
  hint?: string;
  error?: string | null;
  className?: string;
  children: (a11y: A11y) => React.ReactNode;
}) {
  const note = error ?? hint;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className={label}>
        {text}
      </label>
      {children({
        id,
        "aria-describedby": note ? `${id}-note` : undefined,
        "aria-invalid": error ? true : undefined,
      })}
      {note ? (
        <p
          id={`${id}-note`}
          className={cn("text-xs", error ? "text-sm text-danger" : "text-muted-foreground")}
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}
const legend = "mb-3 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase";

/**
 * Full trade entry. Fields keep their native values (uncontrolled) so a refused save never loses
 * what was typed; only the strategy choice is state, to show that strategy's rules.
 */
export function TradeForm({
  tradeId,
  defaults,
  tags,
  strategies,
  zone,
  symbols,
}: {
  tradeId: string | null;
  defaults: TradeDefaults;
  tags: Tag[];
  strategies: Strategy[];
  zone: string;
  symbols: string[];
}) {
  const t = useTranslations("journal");
  const [state, action, pending] = useActionState<JournalState, FormData>(
    saveTrade.bind(null, tradeId),
    null,
  );
  const [strategy, setStrategy] = useState(defaults.strategy);
  const form = useRef<HTMLFormElement>(null);
  const rules = strategies.find((s) => s.id === strategy)?.rules ?? [];
  const bad = (f: string) => state?.status === "error" && Boolean(state.fields?.includes(f));
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const err = (name: string) =>
    bad(name) ? (name === "opened" ? t("errors.order") : t("errors.field")) : null;

  useEffect(() => {
    if (state?.status === "error") {
      const first = state.fields?.[0];
      const el = first
        ? form.current?.querySelector<HTMLElement>(`[name="${CSS.escape(first)}"]`)
        : null;
      (el ?? form.current?.querySelector<HTMLElement>("[role=alert]"))?.focus();
    }
  }, [state]);

  const field = (
    name: keyof TradeDefaults & string,
    text: string,
    opts: { hint?: string; mono?: boolean; type?: string; placeholder?: string } = {},
  ) => (
    <Labelled id={fid(name)} text={text} hint={opts.hint} error={err(name)}>
      {(a11y) => (
        <Input
          {...a11y}
          name={name}
          type={opts.type ?? "text"}
          inputMode={opts.type ? undefined : opts.mono ? "decimal" : undefined}
          defaultValue={String(defaults[name] ?? "")}
          autoComplete="off"
          spellCheck={false}
          placeholder={opts.placeholder}
          className={cn(opts.mono && "font-mono tabular")}
        />
      )}
    </Labelled>
  );

  const scale = (name: "emotionBefore" | "emotionAfter" | "confidence") => (
    <Labelled id={fid(name)} text={t(`form.${name}`)}>
      {(a11y) => (
        <NativeSelect {...a11y} name={name} defaultValue={defaults[name]}>
          <option value="">{t("form.scaleNone")}</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </NativeSelect>
      )}
    </Labelled>
  );

  return (
    // React resets a form after its action; keep what was typed when a save is refused.
    <form
      ref={form}
      action={action}
      noValidate
      onReset={(e) => e.preventDefault()}
      className="space-y-10"
    >
      {state?.status === "error" ? (
        <p
          role="alert"
          tabIndex={-1}
          className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
        >
          {t(`errors.${state.code}`)}
        </p>
      ) : null}

      <fieldset>
        <legend className={legend}>{t("form.basics")}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Labelled
            id={fid("symbol")}
            text={t("form.symbol")}
            hint={t("form.symbolHint")}
            error={err("symbol")}
          >
            {(a11y) => (
              <Input
                {...a11y}
                name="symbol"
                list="trade-symbols"
                defaultValue={defaults.symbol}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                required
                className="font-mono uppercase"
              />
            )}
          </Labelled>
          <Labelled id={fid("direction")} text={t("form.direction")}>
            {(a11y) => (
              <NativeSelect {...a11y} name="direction" defaultValue={defaults.direction}>
                <option value="long">{t("direction.long")}</option>
                <option value="short">{t("direction.short")}</option>
              </NativeSelect>
            )}
          </Labelled>
          {field("closed", t("form.closed"), {
            type: "datetime-local",
            hint: t("form.timeHint", { zone }),
          })}
          {field("opened", t("form.opened"), {
            type: "datetime-local",
            hint: t("form.timeHint", { zone }),
          })}
          {field("lots", t("form.lots"), { mono: true })}
        </div>
        <datalist id="trade-symbols">
          {symbols.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </fieldset>

      <fieldset>
        <legend className={legend}>{t("form.costs")}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Labelled id={fid("currency")} text={t("form.currency")}>
            {(a11y) => (
              <NativeSelect {...a11y} name="currency" defaultValue={defaults.currency}>
                {ACCOUNT_CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </NativeSelect>
            )}
          </Labelled>
          {field("result", t("form.result"), {
            mono: true,
            hint: t("form.resultHint"),
            placeholder: "-45.20",
          })}
          {field("commission", t("form.commission"), { mono: true, hint: t("form.costHint") })}
          {field("swap", t("form.swap"), { mono: true, hint: t("form.costHint") })}
        </div>
      </fieldset>

      <fieldset>
        <legend className={legend}>{t("form.prices")}</legend>
        <p className="-mt-1 mb-4 text-sm text-muted-foreground">{t("form.priceHint")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("entry", t("form.entry"), { mono: true })}
          {field("exit", t("form.exit"), { mono: true })}
          {field("stopLoss", t("form.stopLoss"), { mono: true })}
          {field("takeProfit", t("form.takeProfit"), { mono: true })}
        </div>
      </fieldset>

      <fieldset>
        <legend className={legend}>{t("form.plan")}</legend>
        <div className="space-y-6">
          <Labelled id={fid("strategy")} text={t("form.strategy")} className="max-w-md">
            {(a11y) => (
              <NativeSelect
                {...a11y}
                name="strategy"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
              >
                <option value="">{t("form.noStrategy")}</option>
                {strategies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Labelled>
          {rules.length ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-soft">{t("form.rules")}</p>
              <ul className="divide-y divide-hairline rounded-lg border border-hairline">
                {rules.map((r) => (
                  <li
                    key={r.id}
                    className="grid gap-2 p-3 sm:grid-cols-[1fr_12rem] sm:items-center"
                  >
                    <span id={`rule-${r.id}`} className="text-sm">
                      {r.body}
                    </span>
                    <NativeSelect
                      name={`rule:${r.id}`}
                      aria-labelledby={`rule-${r.id}`}
                      defaultValue={defaults.rules[r.id] ?? ""}
                      className="h-11"
                    >
                      <option value="">{t("form.ruleSkip")}</option>
                      <option value="followed">{t("form.ruleFollowed")}</option>
                      <option value="broken">{t("form.ruleBroken")}</option>
                    </NativeSelect>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {(["setup", "mistake", "emotion"] as const).map((kind) => {
            const list = tags.filter((tag) => tag.kind === kind);
            return (
              <fieldset key={kind}>
                <legend className="mb-2 text-sm font-medium text-text-soft">
                  {t(`form.${kind}`)}
                </legend>
                {list.length ? (
                  <div className="flex flex-wrap gap-2">
                    {list.map((tag) => (
                      <label
                        key={tag.id}
                        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-hairline px-3 text-sm has-[:checked]:border-foreground/40 has-[:checked]:bg-raised has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40"
                      >
                        <input
                          type="checkbox"
                          name="tags"
                          value={tag.id}
                          defaultChecked={defaults.tags.includes(tag.id)}
                          className="size-4 accent-[var(--brand)]"
                        />
                        {tag.name}
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("form.noTags")}</p>
                )}
              </fieldset>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className={legend}>{t("form.mind")}</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          {scale("emotionBefore")}
          {scale("emotionAfter")}
          {scale("confidence")}
        </div>
        <Labelled
          id={fid("notes")}
          text={t("form.notes")}
          hint={t("form.notesHint")}
          error={err("notes")}
          className="mt-4"
        >
          {(a11y) => (
            <textarea
              {...a11y}
              name="notes"
              defaultValue={defaults.notes}
              maxLength={4000}
              rows={5}
              className="w-full rounded-xl border border-hairline bg-ink-deep/60 px-4 py-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-danger"
            />
          )}
        </Labelled>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-6">
        <Button type="submit" size="lg" pending={pending}>
          {pending ? t("form.saving") : t("form.save")}
        </Button>
        <p className="text-sm text-muted-foreground">{t("form.xpHint")}</p>
      </div>
    </form>
  );
}
