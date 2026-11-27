"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, fieldIds } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { saveReview, saveReviewDay, type ReviewState } from "./actions";

const area =
  "block w-full rounded-xl border border-hairline bg-ink-deep/60 px-4 py-3 text-base text-foreground outline-none focus-visible:border-cyan/70 focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-danger";

export type ReviewValues = {
  what_worked: string;
  what_didnt: string;
  costly_mistake: string;
  followed_plan: "yes" | "partly" | "no";
  feeling: number;
  next_rule: string;
  previous_rule_kept: boolean | null;
};

/** The five questions, last week's rule check and next week's rule. */
export function ReviewForm({
  week,
  values,
  previousRule,
}: {
  week: string;
  values: ReviewValues | null;
  previousRule: string | null;
}) {
  const t = useTranslations("journal.review");
  const [state, action, pending] = useActionState<ReviewState, FormData>(saveReview, null);
  const form = useRef<HTMLFormElement>(null);
  const invalid = (name: string) =>
    state?.status === "error" && state.fields?.includes(name) ? true : undefined;

  useEffect(() => {
    if (state?.status === "error" && state.fields?.[0])
      form.current?.querySelector<HTMLElement>(`[name="${CSS.escape(state.fields[0])}"]`)?.focus();
  }, [state]);

  const text = (name: "what_worked" | "what_didnt" | "costly_mistake", label: string) => (
    <Field label={label} htmlFor={name}>
      <textarea
        id={name}
        name={name}
        rows={3}
        maxLength={1000}
        defaultValue={values?.[name] ?? ""}
        aria-invalid={invalid(name)}
        aria-describedby={invalid(name) ? fieldIds(name).error : undefined}
        className={area}
      />
    </Field>
  );

  return (
    <form ref={form} action={action} className="space-y-6">
      <input type="hidden" name="week" value={week} />
      {previousRule ? (
        <fieldset className="space-y-3 rounded-2xl border border-gold/40 bg-gold-soft p-4">
          <legend className="sr-only">{t("previousRule", { rule: previousRule })}</legend>
          <p aria-hidden="true" className="font-semibold text-foreground">
            {t("previousRule", { rule: previousRule })}
          </p>
          <div className="flex flex-wrap gap-2">
            {(["yes", "no"] as const).map((k) => (
              <label
                key={k}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-hairline bg-ink-deep/60 px-4 has-checked:border-gold has-checked:bg-gold/15"
              >
                <input
                  type="radio"
                  name="previous_rule_kept"
                  value={k}
                  defaultChecked={
                    values?.previous_rule_kept === null || values === null
                      ? false
                      : values.previous_rule_kept === (k === "yes")
                  }
                  className="accent-[var(--gold)]"
                />
                {t(`kept.${k}`)}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {text("what_worked", t("whatWorked"))}
      {text("what_didnt", t("whatDidnt"))}
      {text("costly_mistake", t("costlyMistake"))}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-soft">{t("followedPlan")}</legend>
        <div className="flex flex-wrap gap-2">
          {(["yes", "partly", "no"] as const).map((k) => (
            <label
              key={k}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-hairline bg-ink-deep/60 px-4 has-checked:border-brand has-checked:bg-brand/20"
            >
              <input
                type="radio"
                name="followed_plan"
                value={k}
                required
                defaultChecked={values?.followed_plan === k}
                className="accent-[var(--brand)]"
              />
              {t(`plan.${k}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-soft">{t("feeling")}</legend>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className="grid size-11 cursor-pointer place-items-center rounded-xl border border-hairline bg-ink-deep/60 font-mono tabular font-bold has-checked:border-cyan has-checked:bg-cyan/15 has-checked:text-cyan"
            >
              <input
                type="radio"
                name="feeling"
                value={n}
                required
                defaultChecked={values?.feeling === n}
                className="sr-only"
              />
              {n}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label={t("nextRule")} htmlFor="next_rule" hint={t("nextRuleHint")}>
        <input
          id="next_rule"
          name="next_rule"
          maxLength={200}
          defaultValue={values?.next_rule ?? ""}
          aria-invalid={invalid("next_rule")}
          aria-describedby={fieldIds("next_rule").hint}
          className={cn(area, "h-12 py-0")}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" pending={pending}>
          {t(values ? "update" : "save")}
        </Button>
        <p role="status" aria-live="polite" className="text-sm">
          {state?.status === "saved" ? (
            <span className="font-semibold text-positive">
              {t(state.xp > 0 ? "done" : "edited")}
              {state.xp > 0 ? ` +${state.xp} XP` : ""}
            </span>
          ) : state?.status === "error" ? (
            <span className="text-danger">{t(`errors.${state.code}`)}</span>
          ) : null}
        </p>
      </div>
    </form>
  );
}

export function ReviewDayForm({ day }: { day: number }) {
  const t = useTranslations("journal.review");
  const days = t.raw("days") as string[];
  const [state, action, pending] = useActionState(saveReviewDay, "");
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Field label={t("day")} htmlFor="review-day" hint={t("dayHint")} className="min-w-48">
        <select
          id="review-day"
          name="day"
          defaultValue={day}
          className="h-12 w-full rounded-xl border border-hairline bg-ink-deep/60 px-3"
        >
          {days.map((label, i) => (
            <option key={label} value={i}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Button variant="secondary" pending={pending}>
        {t("saveDay")}
      </Button>
      <p role="status" className="w-full text-sm">
        {state === "saved"
          ? t("daySaved")
          : state
            ? t(`errors.${state as "invalid" | "limited" | "unavailable"}`)
            : null}
      </p>
    </form>
  );
}
