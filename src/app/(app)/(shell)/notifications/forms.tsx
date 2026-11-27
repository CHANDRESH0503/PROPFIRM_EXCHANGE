"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { markRead, saveDigest, savePreferences } from "./actions";

const types = ["claim_status", "redemption_status", "coins_released", "journal_review"] as const;
const select =
  "mt-1 block h-11 w-full rounded-xl border border-hairline bg-ink-deep/60 px-3 text-foreground";
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const CAPS = [1, 2, 3, 5, 10];
const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function Preferences({
  settings,
}: {
  settings:
    | (Record<(typeof types)[number], boolean> & {
        quiet_start: number | null;
        quiet_end: number | null;
        daily_cap: number | null;
      })
    | null;
}) {
  const t = useTranslations("inbox");
  const [result, action, pending] = useActionState(savePreferences, "");
  // Controlled so a refused save (React resets uncontrolled fields after an action) keeps the
  // member's choices on screen.
  const [quiet, setQuiet] = useState({
    quiet_start: settings?.quiet_start?.toString() ?? "",
    quiet_end: settings?.quiet_end?.toString() ?? "",
  });
  const [cap, setCap] = useState(settings?.daily_cap?.toString() ?? "");
  return (
    <form action={action} className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-lg font-semibold">{t("prefs")}</legend>
        {types.map((k) => (
          <label key={k} className="flex min-h-11 items-center gap-3">
            <input
              name={k}
              type="checkbox"
              defaultChecked={settings?.[k] ?? true}
              className="size-4 accent-[var(--brand)]"
            />
            {t(k)}
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">{t("channelsTitle")}</legend>
        <p className="text-sm text-text-soft">{t("channelsHelp")}</p>
        <div>
          <p className="text-sm font-medium text-text-soft">{t("quiet")}</p>
          <div className="mt-1 grid max-w-sm grid-cols-2 gap-3">
            {(["quiet_start", "quiet_end"] as const).map((k) => (
              <label key={k} className="text-sm text-text-soft">
                {t(k === "quiet_start" ? "quietFrom" : "quietTo")}
                <select
                  name={k}
                  value={quiet[k]}
                  onChange={(e) => setQuiet((q) => ({ ...q, [k]: e.target.value }))}
                  className={select}
                >
                  <option value="">{t("quietOff")}</option>
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("quietHelp")}</p>
        </div>
        <label className="block max-w-sm text-sm text-text-soft">
          {t("cap")}
          <select
            name="daily_cap"
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            className={select}
          >
            <option value="">{t("capOff")}</option>
            {CAPS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted-foreground">{t("capHelp")}</span>
        </label>
      </fieldset>
      <Button type="submit" variant="secondary" disabled={pending}>
        {t("save")}
      </Button>
      <p role="status">{result && t(result as "limited" | "failed" | "saved" | "invalidQuiet")}</p>
    </form>
  );
}
export function ReadItem({ id }: { id: number }) {
  const t = useTranslations("inbox");
  const [result, action, pending] = useActionState(markRead, "");
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" disabled={pending}>
        {t("read")}
      </Button>
      {result && <p role="status">{t(result as "limited" | "failed")}</p>}
    </form>
  );
}

const DIGEST_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "CNY"] as const;

export function DigestForm({
  settings,
}: {
  settings: { active: boolean; currencies: string[]; send_hour: number } | null;
}) {
  const t = useTranslations("inbox");
  const [result, action, pending] = useActionState(saveDigest, "");
  // Controlled so a refused save keeps the member's choices.
  const [on, setOn] = useState(settings?.active ?? false);
  const [picked, setPicked] = useState<string[]>(settings?.currencies ?? ["USD"]);
  const [hour, setHour] = useState(String(settings?.send_hour ?? 7));
  return (
    <form action={action} className="space-y-4">
      <label className="flex min-h-11 items-center gap-3 font-medium">
        <input
          type="checkbox"
          name="digest_on"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          className="size-4 accent-[var(--brand)]"
        />
        {t("digestOn")}
      </label>
      <fieldset>
        <legend className="text-sm font-medium text-text-soft">{t("digestCurrencies")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {DIGEST_CURRENCIES.map((c) => (
            <label
              key={c}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-hairline bg-ink-deep/60 px-3.5 font-mono text-sm has-checked:border-cyan has-checked:bg-cyan/15"
            >
              <input
                type="checkbox"
                name="digest_currency"
                value={c}
                checked={picked.includes(c)}
                onChange={(e) =>
                  setPicked((p) => (e.target.checked ? [...p, c] : p.filter((x) => x !== c)))
                }
                className="size-4 accent-[var(--cyan)]"
              />
              {c}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block max-w-xs text-sm text-text-soft">
        {t("digestHour")}
        <select
          name="digest_hour"
          value={hour}
          onChange={(e) => setHour(e.target.value)}
          className={select}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {hourLabel(h)}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" variant="secondary" disabled={pending}>
        {t("digestSave")}
      </Button>
      <p role="status">
        {result && t(result as "limited" | "failed" | "digestSaved" | "digestInvalid")}
      </p>
    </form>
  );
}
