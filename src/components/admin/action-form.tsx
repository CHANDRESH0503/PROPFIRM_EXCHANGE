"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/admin/result";
import { cn } from "@/lib/utils";

type Action = (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;

/**
 * Staff form: pending state, translated result, and a per-mount idempotency key so a retry or
 * double click never applies an action twice. Fields keep their values when refused.
 */
export function ActionForm({
  action,
  submit,
  children,
  className,
  variant = "primary",
  resetOnSuccess = false,
}: {
  action: Action;
  submit: string;
  children?: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "danger";
  resetOnSuccess?: boolean;
}) {
  const t = useTranslations("results");
  const [state, run, pending] = useActionState<ActionResult | null, FormData>(action, null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(t(state.key === "sent" ? "sent" : "saved"));
      // A new key for the next action, and optionally a fresh form.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to a completed action
      setRequestId(crypto.randomUUID());
      if (resetOnSuccess) setRound((r) => r + 1);
    }
  }, [state, t, resetOnSuccess]);

  return (
    <form
      key={round}
      action={run}
      onReset={(e) => e.preventDefault()}
      className={cn("space-y-3", className)}
    >
      <input type="hidden" name="requestId" value={requestId} />
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant={variant} pending={pending}>
          {submit}
        </Button>
        {state && !state.ok ? (
          <p role="alert" className="text-sm text-danger">
            {t(state.key)}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export { Labelled, inputClass, areaClass } from "./form-fields";
