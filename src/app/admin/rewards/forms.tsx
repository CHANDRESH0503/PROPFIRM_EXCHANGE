"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/lib/supabase/database.types";
import { saveReward, addVouchers, cancelReward } from "./actions";
const control =
  "mt-1 block min-h-11 w-full rounded-xl border border-hairline bg-ink-deep/60 px-3 py-2";
function Reason() {
  const t = useTranslations("stock");
  return (
    <label className="block">
      {t("reason")}
      <input className={control} name="reason" required minLength={3} maxLength={1000} />
    </label>
  );
}
function Result({ value }: { value: string }) {
  const t = useTranslations("stock");
  return value ? (
    <p role="status">
      {t(
        value as
          "invalid" | "limited" | "unavailable" | "stale" | "stocked" | "refunded" | "keyMissing",
      )}
    </p>
  ) : null;
}
export function RewardEditor({
  reward,
  programs,
}: {
  reward: Tables<"rewards"> | null;
  programs: { id: string; name: string }[];
}) {
  const t = useTranslations("stock");
  const [state, action, pending] = useActionState(saveReward, "");
  return (
    <form action={action} className="max-w-2xl space-y-4">
      <input type="hidden" name="id" value={reward?.id ?? ""} />
      <input type="hidden" name="revision" value={reward?.revision ?? 0} />
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            "name",
            "description",
            "instructions",
            "cost_coins",
            "per_user_limit",
            "min_tier",
            "low_stock",
            "countries",
            "starts_at",
            "ends_at",
          ] as const
        ).map((k) => {
          const type = k.endsWith("_at")
            ? "datetime-local"
            : ["cost_coins", "per_user_limit", "min_tier", "low_stock"].includes(k)
              ? "number"
              : "text";
          const v = reward?.[k];
          const value =
            type === "datetime-local" && typeof v === "string"
              ? new Date(v).toISOString().slice(0, 16)
              : String(v ?? (k === "min_tier" ? 1 : k === "low_stock" ? 5 : ""));
          return (
            <label className="text-sm" key={k}>
              {t(k)}
              {["description", "instructions"].includes(k) ? (
                <textarea className={control} required name={k} defaultValue={value} />
              ) : (
                <input
                  className={control}
                  name={k}
                  type={type}
                  defaultValue={value}
                  required={["name", "cost_coins", "min_tier", "low_stock"].includes(k)}
                />
              )}
            </label>
          );
        })}
        <label>
          {t("kind")}
          <select
            className={control}
            name="kind"
            defaultValue={reward?.kind ?? "free_challenge_voucher"}
          >
            {(["free_challenge_voucher", "discount_voucher", "booster"] as const).map((k) => (
              <option key={k} value={k}>
                {t(k)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("program")}
          <select className={control} name="program_id" defaultValue={reward?.program_id ?? ""}>
            <option value="">{t("noProgram")}</option>
            {programs.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" name="active" defaultChecked={reward?.active} />
        {t("active")}
      </label>
      <Reason />
      <Button pending={pending}>{t("save")}</Button>
      <Result value={state} />
    </form>
  );
}
export function StockForm({ id }: { id: string }) {
  const t = useTranslations("stock");
  const [state, action, pending] = useActionState(addVouchers, "");
  return (
    <form action={action} className="max-w-xl space-y-3">
      <input type="hidden" name="id" value={id} />
      <label className="block">
        {t("codes")}
        <textarea
          className={control}
          rows={5}
          autoComplete="off"
          spellCheck={false}
          name="codes"
          required
        />
      </label>
      <label className="block">
        {t("expiry")}
        <input className={control} type="datetime-local" name="expiry" />
      </label>
      <Reason />
      <Button pending={pending}>{t("upload")}</Button>
      <Result value={state} />
    </form>
  );
}
export function RefundForm({ id }: { id: string }) {
  const t = useTranslations("stock");
  const [state, action, pending] = useActionState(cancelReward, "");
  return (
    <details>
      <summary className="min-h-11 cursor-pointer py-3">{t("refund")}</summary>
      <form action={action} className="max-w-md space-y-3">
        <input type="hidden" name="id" value={id} />
        <Reason />
        <Button pending={pending} variant="secondary">
          {t("confirmRefund")}
        </Button>
        <Result value={state} />
      </form>
    </details>
  );
}
