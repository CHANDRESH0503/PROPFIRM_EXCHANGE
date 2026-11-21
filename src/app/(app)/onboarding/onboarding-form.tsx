"use client";

import { useActionState, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { brand } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { Field, fieldIds } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { completeOnboarding, type OnboardingState } from "./actions";

const initial: OnboardingState = { status: "idle" };

const selectClass =
  "h-12 w-full appearance-none rounded-lg border border-hairline bg-surface bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2016%2016%22%3E%3Cpath%20d=%22M4%206l4%204%204-4%22%20fill=%22none%22%20stroke=%22%239AA3AF%22%20stroke-width=%221.5%22/%3E%3C/svg%3E')] bg-[length:1rem] bg-[right_1rem_center] bg-no-repeat pr-10 pl-4 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-danger";

/**
 * Native selects: on a phone they open the OS picker, which beats any custom listbox for 250
 * countries. Timezone is detected from the device and editable.
 */
export function OnboardingForm({ countries, next }: { countries: { code: string; name: string }[]; next: string }) {
  const t = useTranslations("onboarding");
  const [state, action, pending] = useActionState(completeOnboarding, initial);
  // The device's zone; UTC on the server and during hydration.
  const detected = useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    () => "UTC",
  );
  const returned = state.status === "error" ? state.values : null;
  const [chosen, setChosen] = useState<string | null>(returned?.timezone || null);
  // Controlled, because React resets uncontrolled fields after every action, including a refused one.
  const [country, setCountry] = useState(returned?.country ?? "");
  const [isAdult, setIsAdult] = useState(returned?.isAdult ?? false);
  const timezone = chosen ?? detected;
  // The zone list and its offset labels come from the runtime's ICU data, which differs between
  // Node and each browser, so the full list renders only after hydration.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const zones = useMemo(() => {
    if (!hydrated) return [timezone];
    const all = Intl.supportedValuesOf("timeZone");
    return all.includes(timezone) ? all : [timezone, ...all];
  }, [timezone, hydrated]);

  const errors = useMemo(() => (state.status === "error" ? state.fieldErrors : {}), [state]);
  useEffect(() => {
    if (state.status !== "error") return;
    const key = (["country", "timezone", "isAdult"] as const).find((k) => errors[k]);
    if (key) document.getElementById(key)?.focus();
  }, [state, errors]);

  const formError = state.status === "error" && state.code ? t(`errors.${state.code}`) : null;

  return (
    <form action={action} className="mt-8 space-y-6" noValidate>
      <input type="hidden" name="next" value={next} />

      <Field label={t("country")} htmlFor="country" hint={t("countryHint")} error={errors.country}>
        <select
          id="country"
          name="country"
          required
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          autoComplete="country"
          className={selectClass}
          aria-invalid={errors.country ? true : undefined}
          aria-describedby={errors.country ? fieldIds("country").error : fieldIds("country").hint}
        >
          <option value="" disabled>
            {t("countryPlaceholder")}
          </option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t("timezone")} htmlFor="timezone" hint={t("timezoneHint")} error={errors.timezone}>
        <select
          id="timezone"
          name="timezone"
          required
          value={timezone}
          onChange={(e) => setChosen(e.target.value)}
          className={selectClass}
          aria-invalid={errors.timezone ? true : undefined}
          aria-describedby={errors.timezone ? fieldIds("timezone").error : fieldIds("timezone").hint}
        >
          {zones.map((z) => (
            <option key={z} value={z}>
              {hydrated ? zoneLabel(z) : z}
            </option>
          ))}
        </select>
      </Field>

      <div className="space-y-2">
        <label
          htmlFor="isAdult"
          className={cn(
            "flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border border-hairline bg-surface px-4 py-3",
            errors.isAdult && "border-danger",
          )}
        >
          <input
            id="isAdult"
            name="isAdult"
            type="checkbox"
            required
            checked={isAdult}
            onChange={(e) => setIsAdult(e.target.checked)}
            className="mt-0.5 grid size-5 shrink-0 cursor-pointer appearance-none place-content-center rounded-[5px] border border-[color-mix(in_oklab,var(--hairline)_40%,var(--text))] bg-ink transition-colors before:size-2.5 before:scale-0 before:bg-ink before:transition-transform before:[clip-path:polygon(14%_44%,0_65%,50%_100%,100%_16%,80%_0%,43%_62%)] checked:border-text checked:bg-text checked:before:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-invalid={errors.isAdult ? true : undefined}
            aria-describedby={fieldIds("isAdult").error}
          />
          <span>
            <span className="block font-medium text-foreground">{t("adult")}</span>
            <span className="block text-sm text-muted-foreground">{t("adultHint", { brand: brand.name })}</span>
          </span>
        </label>
        <p id={fieldIds("isAdult").error} aria-live="polite" className={cn("text-sm text-danger", !errors.isAdult && "sr-only")}>
          {errors.isAdult ?? ""}
        </p>
      </div>

      {formError ? (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      ) : null}

      <Button type="submit" size="lg" block pending={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}

function noopSubscribe() {
  return () => {};
}

/** "Kolkata (GMT+5:30)" for "Asia/Calcutta": the city as people know it, plus the offset. */
const CITY_RENAMES: Record<string, string> = { Calcutta: "Kolkata", Saigon: "Ho Chi Minh City", Kiev: "Kyiv", Rangoon: "Yangon", Katmandu: "Kathmandu" };

function zoneLabel(zone: string): string {
  const raw = zone.split("/").at(-1)!.replaceAll("_", " ");
  const city = CITY_RENAMES[raw] ?? raw;
  try {
    const offset = new Intl.DateTimeFormat("en-GB", { timeZone: zone, timeZoneName: "shortOffset" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value;
    return offset ? `${city} (${offset})` : city;
  } catch {
    return city;
  }
}
