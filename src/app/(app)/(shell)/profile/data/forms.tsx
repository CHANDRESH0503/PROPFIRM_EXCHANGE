"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/admin/result";
import { cancelDeletion, confirmDeletion, requestDeletion } from "./actions";

function Result({ state }: { state: ActionResult | null }) {
  const r = useTranslations("results");
  const t = useTranslations("dataRights");
  if (!state) return null;
  return state.ok ? (
    <p role="status" className="text-sm text-positive">
      {state.key === "sent" ? t("emailSent") : r("saved")}
    </p>
  ) : (
    <p role="alert" className="text-sm text-danger">
      {r(state.key)}
    </p>
  );
}

export function RequestDeletion() {
  const t = useTranslations("dataRights");
  const [state, action, pending] = useActionState<ActionResult | null>(requestDeletion, null);
  return (
    <form action={action} className="space-y-2">
      <Button type="submit" variant="danger" pending={pending}>
        {t("delete")}
      </Button>
      <Result state={state} />
    </form>
  );
}

export function CancelDeletion() {
  const t = useTranslations("dataRights");
  const [state, action, pending] = useActionState<ActionResult | null>(cancelDeletion, null);
  return (
    <form action={action} className="space-y-2">
      <Button type="submit" variant="secondary" pending={pending}>
        {t("cancel")}
      </Button>
      <Result state={state} />
    </form>
  );
}

export function ConfirmDeletion({ token }: { token: string }) {
  const t = useTranslations("dataRights");
  const [state, action, pending] = useActionState<ActionResult | null>(
    confirmDeletion.bind(null, token),
    null,
  );
  return (
    <form action={action} className="space-y-2">
      <Button type="submit" variant="danger" pending={pending}>
        {t("confirm")}
      </Button>
      <Result state={state} />
    </form>
  );
}
