"use client";
import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Turnstile } from "@/components/auth/turnstile";
import { submitClaim } from "./actions";

export function ClaimForm({ id, label }: { id: string; label: string }) {
  const t = useTranslations("purchase");
  const [result, action, pending] = useActionState(submitClaim, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (result?.field)
      form.current?.querySelector<HTMLElement>(`[name="${CSS.escape(result.field)}"]`)?.focus();
  }, [result]);
  return (
    <form ref={form} action={action} className="max-w-lg space-y-4">
      <h2 className="text-lg font-semibold">{label}</h2>
      <input type="hidden" name="program" value={id} />
      {(["reference", "purchased", "amount", "email", "receipt"] as const).map((key) => (
        <Field
          htmlFor={key}
          label={t(key)}
          key={key}
          error={
            result?.field === key
              ? t(result.code === "receipt" ? "fileError" : "invalid")
              : undefined
          }
        >
          <Input
            name={key}
            id={key}
            type={
              key === "receipt"
                ? "file"
                : key === "purchased"
                  ? "date"
                  : key === "email"
                    ? "email"
                    : "text"
            }
            inputMode={key === "amount" ? "decimal" : undefined}
            accept={key === "receipt" ? "image/png,image/jpeg,application/pdf" : undefined}
            autoComplete={key === "email" ? "email" : "off"}
            aria-invalid={result?.field === key || undefined}
            aria-describedby={result?.field === key ? key + "-error" : undefined}
            required
          />
        </Field>
      ))}
      <Turnstile action="claim" resetKey={result} />
      {result && !result.field && (
        <p role="alert" className="text-danger">
          {t(result.code === "receipt" ? "fileError" : result.code)}
        </p>
      )}
      <Button pending={pending}>{t(pending ? "submitting" : "submit")}</Button>
    </form>
  );
}
