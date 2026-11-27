"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { quickLog, type JournalState } from "@/app/(app)/(shell)/accounts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { ACCOUNT_CURRENCIES } from "@/lib/tools/instruments";
import type { Tag } from "@/lib/journal/data";

export function QuickLog(props: { tags: Tag[]; currency: string; symbols: string[] }) {
  // A new key after each saved trade gives a clean form; refused saves keep the typed values.
  const [round, setRound] = useState(0);
  return <QuickLogForm key={round} {...props} onSaved={() => setRound((r) => r + 1)} />;
}

function QuickLogForm({
  tags,
  currency,
  symbols,
  onSaved,
}: {
  tags: Tag[];
  currency: string;
  symbols: string[];
  onSaved: () => void;
}) {
  const t = useTranslations("journal");
  const [state, action, pending] = useActionState<JournalState, FormData>(quickLog, null);
  const form = useRef<HTMLFormElement>(null);
  const bad = (f: string) => state?.status === "error" && state.fields?.includes(f);

  useEffect(() => {
    if (state?.status === "saved") {
      toast.success(t("quick.saved"));
      onSaved();
    }
    if (state?.status === "error" && state.fields?.length) {
      form.current?.querySelector<HTMLElement>(`[name="${CSS.escape(state.fields[0]!)}"]`)?.focus();
    }
  }, [state, t, onSaved]);

  return (
    <form
      ref={form}
      action={action}
      className="space-y-3"
      noValidate
      onReset={(e) => e.preventDefault()}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_auto_1fr_auto]">
        <label className="space-y-1.5 text-sm text-text-soft">
          <span>{t("quick.symbol")}</span>
          <Input
            name="symbol"
            list="journal-symbols"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            required
            aria-invalid={bad("symbol") || undefined}
            className="font-mono uppercase"
          />
        </label>
        <label className="space-y-1.5 text-sm text-text-soft">
          <span>{t("quick.direction")}</span>
          <NativeSelect name="direction" defaultValue="long">
            <option value="long">{t("direction.long")}</option>
            <option value="short">{t("direction.short")}</option>
          </NativeSelect>
        </label>
        <label className="space-y-1.5 text-sm text-text-soft">
          <span>{t("quick.result")}</span>
          <Input
            name="result"
            inputMode="text"
            autoComplete="off"
            placeholder="-45.20"
            required
            aria-invalid={bad("result") || undefined}
            className="font-mono tabular"
          />
        </label>
        <label className="space-y-1.5 text-sm text-text-soft">
          <span>{t("quick.currency")}</span>
          <NativeSelect name="currency" defaultValue={currency}>
            {ACCOUNT_CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </NativeSelect>
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-48 flex-1 space-y-1.5 text-sm text-text-soft">
          <span>{t("quick.tag")}</span>
          <NativeSelect name="tag" defaultValue="">
            <option value="">{t("quick.noTag")}</option>
            {(["setup", "mistake", "emotion"] as const).map((kind) => (
              <optgroup key={kind} label={t(`kinds.${kind}`)}>
                {tags
                  .filter((tag) => tag.kind === kind)
                  .map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </NativeSelect>
        </label>
        <Button type="submit" pending={pending}>
          {t("quick.submit")}
        </Button>
      </div>
      <datalist id="journal-symbols">
        {symbols.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {state?.status === "error" ? (
        <p role="alert" className="text-sm text-danger">
          {t(`errors.${state.code}`)}
        </p>
      ) : null}
    </form>
  );
}
