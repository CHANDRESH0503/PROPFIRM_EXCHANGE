"use client";

import { useTranslations } from "next-intl";
import { ActionForm, Labelled, areaClass, inputClass } from "@/components/admin/action-form";
import { NativeSelect } from "@/components/ui/native-select";
import {
  addNote,
  adjustXp,
  grantBooster,
  grantCoins,
  removeCoins,
  setRestriction,
} from "../actions";

export function MemberActions({
  member,
  budgets,
  threshold,
  restriction,
  canFinance,
}: {
  member: string;
  budgets: { id: string; name: string; remaining: number }[];
  threshold: number;
  restriction: string | null;
  canFinance: boolean;
}) {
  const t = useTranslations("adminUsers");
  const confirm = (
    <label className="flex min-h-11 items-center gap-2 text-sm text-text-soft">
      <input type="checkbox" name="confirmed" className="size-4" />
      {t("confirmLarge", { threshold })}
    </label>
  );
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="space-y-3 rounded-xl border border-hairline p-4">
        <h2 className="font-semibold">{t("restrictTitle")}</h2>
        <ActionForm
          action={setRestriction.bind(null, member)}
          submit={t("restrictSave")}
          variant="secondary"
        >
          <Labelled label={t("level")}>
            <NativeSelect name="level" defaultValue={restriction ?? "none"} className="h-11">
              {(["none", "frozen", "suspended", "banned"] as const).map((l) => (
                <option key={l} value={l}>
                  {t(`levels.${l}`)}
                </option>
              ))}
            </NativeSelect>
          </Labelled>
          <Labelled label={t("reason")}>
            <input name="reason" required minLength={3} maxLength={1000} className={inputClass} />
          </Labelled>
          <Labelled label={t("memberMessage")}>
            <input name="message" maxLength={500} className={inputClass} />
          </Labelled>
        </ActionForm>
      </section>

      {canFinance ? (
        <section className="space-y-3 rounded-xl border border-hairline p-4">
          <h2 className="font-semibold">{t("grantTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("grantHint")}</p>
          {budgets.length ? (
            <ActionForm
              action={grantCoins.bind(null, member)}
              submit={t("grantSave")}
              resetOnSuccess
            >
              <Labelled label={t("budget")}>
                <NativeSelect name="budget" className="h-11">
                  {budgets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {t("budgetOption", { name: b.name, remaining: b.remaining })}
                    </option>
                  ))}
                </NativeSelect>
              </Labelled>
              <Labelled label={t("amount")}>
                <input name="amount" inputMode="numeric" required className={inputClass} />
              </Labelled>
              <Labelled label={t("reason")}>
                <input name="reason" required minLength={3} className={inputClass} />
              </Labelled>
              <Labelled label={t("note")}>
                <input name="note" maxLength={300} className={inputClass} />
              </Labelled>
              {confirm}
            </ActionForm>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noBudgets")}</p>
          )}
        </section>
      ) : null}

      {canFinance ? (
        <section className="space-y-3 rounded-xl border border-hairline p-4">
          <h2 className="font-semibold">{t("removeTitle")}</h2>
          <ActionForm
            action={removeCoins.bind(null, member)}
            submit={t("removeSave")}
            variant="danger"
            resetOnSuccess
          >
            <Labelled label={t("amount")}>
              <input name="amount" inputMode="numeric" required className={inputClass} />
            </Labelled>
            <Labelled label={t("reason")}>
              <input name="reason" required minLength={3} className={inputClass} />
            </Labelled>
            <Labelled label={t("note")}>
              <input name="note" maxLength={300} className={inputClass} />
            </Labelled>
            {confirm}
          </ActionForm>
        </section>
      ) : null}

      <section className="space-y-3 rounded-xl border border-hairline p-4">
        <h2 className="font-semibold">{t("xpTitle")}</h2>
        <ActionForm
          action={adjustXp.bind(null, member)}
          submit={t("xpSave")}
          variant="secondary"
          resetOnSuccess
        >
          <Labelled label={t("xpAmount")}>
            <input name="amount" inputMode="text" required className={inputClass} />
          </Labelled>
          <Labelled label={t("reason")}>
            <input name="reason" required minLength={3} className={inputClass} />
          </Labelled>
        </ActionForm>
        <ActionForm
          action={grantBooster.bind(null, member)}
          submit={t("boosterSave")}
          variant="secondary"
          resetOnSuccess
        >
          <Labelled label={t("booster")}>
            <NativeSelect name="booster" className="h-11">
              {(["giveback3", "giveback5", "xp24", "freeze1"] as const).map((b) => (
                <option key={b} value={b}>
                  {t(`boosters.${b}`)}
                </option>
              ))}
            </NativeSelect>
          </Labelled>
          <Labelled label={t("reason")}>
            <input name="reason" required minLength={3} className={inputClass} />
          </Labelled>
        </ActionForm>
      </section>

      <section className="space-y-3 rounded-xl border border-hairline p-4">
        <h2 className="font-semibold">{t("noteTitle")}</h2>
        <ActionForm
          action={addNote.bind(null, member)}
          submit={t("noteSave")}
          variant="secondary"
          resetOnSuccess
        >
          <Labelled label={t("noteBody")}>
            <textarea name="body" rows={3} required maxLength={2000} className={areaClass} />
          </Labelled>
        </ActionForm>
      </section>
    </div>
  );
}
