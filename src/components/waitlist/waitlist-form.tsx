"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { MailCheck } from "lucide-react";
import { joinWaitlist, type WaitlistState } from "@/app/(public)/waitlist/actions";
import { Turnstile } from "@/components/auth/turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const initial: WaitlistState = { status: "idle" };

/**
 * The reply slip of the founding letter. Works without JavaScript (plain form post to the
 * Server Action); with JavaScript it shows pending state, blocks double submits and keeps the
 * email when an error comes back. Referral (?ref=) and source (?utm_source=) come from the URL.
 */
export function WaitlistForm({
  id,
  className,
  showFine = true,
}: {
  id: string;
  className?: string;
  showFine?: boolean;
}) {
  const t = useTranslations("waitlist");
  const params = useSearchParams();
  const [state, action, pending] = useActionState(joinWaitlist, initial);
  // The "sent" panel hides when the user asks to change the email; a new result shows it again.
  const [dismissed, setDismissed] = useState<unknown>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const linkError = params.get("link");

  useEffect(() => {
    if (state.status === "error") inputRef.current?.focus();
  }, [state]);

  if (state.status === "sent" && dismissed !== state) {
    return (
      <div role="status" className={cn("rounded-2xl p-5 panel", className)}>
        <div className="flex items-start gap-3">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-positive" aria-hidden="true" />
          <div className="space-y-1.5">
            <p className="font-heading text-base font-semibold">{t("sentTitle")}</p>
            <p className="text-sm leading-relaxed text-text-soft">
              {t("sentBody", { email: state.email })}
            </p>
            <button
              type="button"
              onClick={() => setDismissed(state)}
              className="inline-flex min-h-11 items-center text-sm text-foreground underline decoration-hairline hover:decoration-current"
            >
              {t("sendAgain")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const errorCode = state.status === "error" ? state.code : null;
  const errorText = errorCode
    ? t(`errors.${errorCode}`)
    : linkError === "invalid" || linkError === "unavailable"
      ? t(`link.${linkError}`)
      : null;
  const errorId = `${id}-error`;

  return (
    <form action={action} className={cn("space-y-3", className)} noValidate={false}>
      <input type="hidden" name="ref" value={params.get("ref") ?? ""} />
      <input type="hidden" name="source" value={params.get("utm_source") ?? ""} />
      <label htmlFor={id} className="sr-only">
        {t("label")}
      </label>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <Input
          ref={inputRef}
          id={id}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={254}
          placeholder={t("placeholder")}
          aria-invalid={errorCode === "invalid_email" || undefined}
          aria-describedby={errorText ? errorId : `${id}-fine`}
          className="sm:flex-1"
        />
        <Button type="submit" size="lg" pending={pending} className="sm:w-auto" block>
          {pending ? t("submitting") : t("submit")}
        </Button>
      </div>
      <Turnstile action="waitlist" resetKey={state} />
      <p
        id={errorId}
        aria-live="polite"
        className={cn("text-sm text-danger", !errorText && "sr-only")}
      >
        {errorText ?? ""}
      </p>
      <p
        id={`${id}-fine`}
        className={cn("text-sm leading-relaxed text-muted-foreground", !showFine && "sr-only")}
      >
        {t("fine")}
      </p>
    </form>
  );
}
