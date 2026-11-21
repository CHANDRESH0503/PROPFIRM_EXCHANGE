"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { setFeatureFlag, type FlagActionState } from "./actions";

interface Flag {
  key: string;
  enabled: boolean;
  description: string;
}

const initial: FlagActionState = { status: "idle" };

/** One flag. Changing it asks for a reason inline (no modal), which goes to the audit log. */
export function FlagRow({ flag, canEdit, chance }: { flag: Flag; canEdit: boolean; chance: boolean }) {
  const t = useTranslations("admin.flags");
  const [state, action, pending] = useActionState(setFeatureFlag, initial);
  // Open until the next successful save: `openedWith` is the result current when it was opened.
  const [openedWith, setOpenedWith] = useState<FlagActionState | null>(null);
  const open = openedWith !== null && (openedWith === state || state.status === "error");

  useEffect(() => {
    if (state.status === "saved") toast.success(`${flag.key}: ${t("saved")}`);
  }, [state, flag.key, t]);

  const reasonId = `reason-${flag.key}`;
  return (
    <li className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-mono text-sm text-foreground">{flag.key}</p>
          <p className="text-sm text-muted-foreground">{flag.description}</p>
          {chance ? (
            <p className="flex items-center gap-1.5 text-xs text-caution">
              <TriangleAlert className="size-3.5" aria-hidden="true" />
              {t("chanceWarning")}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <span className={cn("text-sm font-medium", flag.enabled ? "text-positive" : "text-muted-foreground")}>
            {flag.enabled ? t("on") : t("off")}
          </span>
          {canEdit && !open ? (
            <Button variant="secondary" size="sm" onClick={() => setOpenedWith(state)} aria-expanded={open} aria-controls={reasonId}>
              {flag.enabled ? t("turnOff") : t("turnOn")}
            </Button>
          ) : null}
        </div>
      </div>

      {canEdit && open ? (
        <form action={action} className="flex flex-col gap-2.5 sm:flex-row sm:items-start" id={reasonId}>
          <input type="hidden" name="key" value={flag.key} />
          <input type="hidden" name="enabled" value={String(!flag.enabled)} />
          <label htmlFor={`${reasonId}-input`} className="sr-only">
            {t("reason")}
          </label>
          <Input
            id={`${reasonId}-input`}
            name="reason"
            required
            minLength={5}
            maxLength={1000}
            placeholder={t("reason")}
            autoFocus
            aria-invalid={state.status === "error" || undefined}
            aria-describedby={state.status === "error" ? `${reasonId}-error` : undefined}
            className="h-11 sm:flex-1"
          />
          <div className="flex gap-2">
            <Button type="submit" pending={pending} variant={flag.enabled ? "danger" : "primary"}>
              {flag.enabled ? t("turnOff") : t("turnOn")}
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => setOpenedWith(null)} aria-label={t("cancel")}>
              <X aria-hidden="true" />
            </Button>
          </div>
          {state.status === "error" ? (
            <p id={`${reasonId}-error`} role="alert" className="text-sm text-danger sm:basis-full">
              {state.message}
            </p>
          ) : null}
        </form>
      ) : null}
    </li>
  );
}
