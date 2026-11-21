"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { MailCheck } from "lucide-react";
import { Turnstile } from "@/components/auth/turnstile";
import { Button } from "@/components/ui/button";
import { Field, fieldIds } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signInWithEmail, signInWithGoogle, type SignInState } from "./actions";

const initial: SignInState = { status: "idle" };
const URL_ERRORS = new Set(["link", "oauth"]);

export function SignInForm() {
  const t = useTranslations("auth");
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  const ref = params.get("ref") ?? "";
  const [state, action, pending] = useActionState(signInWithEmail, initial);
  // The "sent" panel hides when the user asks to change the email; a new result shows it again.
  const [dismissed, setDismissed] = useState<unknown>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.status === "error") inputRef.current?.focus();
  }, [state]);

  if (state.status === "sent" && dismissed !== state) {
    return (
      <div role="status" className="mt-8 rounded-xl border border-hairline bg-surface p-5">
        <div className="flex items-start gap-3">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-positive" aria-hidden="true" />
          <div className="space-y-1.5">
            <p className="font-heading text-base font-semibold">{t("sentTitle")}</p>
            <p className="text-sm leading-relaxed text-text-soft">{t("sentBody", { email: state.email })}</p>
            <button
              type="button"
              onClick={() => setDismissed(state)}
              className="inline-flex min-h-11 items-center text-sm underline decoration-hairline hover:decoration-current"
            >
              {t("useDifferent")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const urlError = params.get("error");
  const error =
    state.status === "error" ? t(`errors.${state.code}`) : urlError && URL_ERRORS.has(urlError) ? t(`errors.${urlError as "link" | "oauth"}`) : undefined;
  const ids = fieldIds("email");

  return (
    <div className="mt-8 space-y-6">
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="secondary" size="lg" block>
          <GoogleMark />
          {t("google")}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-hairline" />
        {t("or")}
        <span className="h-px flex-1 bg-hairline" />
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="ref" value={ref} />
        <Field label={t("email")} htmlFor="email" error={error}>
          <Input
            ref={inputRef}
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={254}
            aria-invalid={state.status === "error" && state.code === "invalid_email" ? true : undefined}
            aria-describedby={error ? ids.error : undefined}
          />
        </Field>
        <Turnstile action="sign_in" resetKey={state} />
        <Button type="submit" size="lg" block pending={pending}>
          {pending ? t("sending") : t("sendLink")}
        </Button>
      </form>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
