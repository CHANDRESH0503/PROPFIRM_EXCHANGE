"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Tables } from "@/lib/supabase/database.types";
import { saveEconomy } from "./actions";
export function EconomyForm({ config }: { config: Tables<"economy_config"> }) {
  const t = useTranslations("rates");
  const [state, action, pending] = useActionState(saveEconomy, "");
  return (
    <form className="max-w-2xl space-y-6" action={action}>
      <input type="hidden" name="version" value={config.version} />
      <fieldset>
        <legend className="font-semibold">{t("levels")}</legend>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(["Bronze", "Silver", "Gold", "Platinum", "Black"] as const).map((name, i) => (
            <label key={name}>
              {name}
              <Input
                type="number"
                name="level_share_bps"
                min={0}
                max={10000}
                required
                defaultValue={config.level_share_bps[i]}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            "founding_share_bps",
            "max_total_giveback_bps",
            "referral_bps",
            "monthly_cap",
            "hold_days",
            "founding_days",
            "founding_buyers",
          ] as const
        ).map((k) => (
          <label key={k}>
            {t(k)}
            <Input name={k} type="number" min={0} required defaultValue={config[k]} />
          </label>
        ))}
        <label>
          {t("starts")}
          <Input
            type="datetime-local"
            name="founding_starts_at"
            defaultValue={
              config.founding_starts_at
                ? new Date(config.founding_starts_at).toISOString().slice(0, 16)
                : ""
            }
          />
        </label>
      </div>
      <label className="block">
        {t("reason")}
        <Input name="reason" minLength={3} maxLength={1000} required />
      </label>
      <Button pending={pending}>{t("save")}</Button>
      {state && <p role="status">{t(state as "saved" | "stale" | "invalid" | "limited")}</p>}
    </form>
  );
}
