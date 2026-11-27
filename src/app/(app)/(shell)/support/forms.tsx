"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { ActionResult } from "@/lib/admin/result";
import { openTicket, replyTicket } from "./actions";

const area =
  "w-full rounded-xl border border-hairline bg-ink-deep/60 px-4 py-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

export function NewTicket({ links }: { links: { value: string; label: string }[] }) {
  const t = useTranslations("support");
  const r = useTranslations("results");
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(openTicket, null);
  return (
    <form action={action} onReset={(e) => e.preventDefault()} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="topic" className="block text-sm text-text-soft">
            {t("topic")}
          </label>
          <NativeSelect id="topic" name="topic" defaultValue="other">
            {(["claim", "redemption", "coins", "account", "journal", "other"] as const).map((k) => (
              <option key={k} value={k}>
                {t(`topics.${k}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="link" className="block text-sm text-text-soft">
            {t("link")}
          </label>
          <NativeSelect id="link" name="link" defaultValue="">
            <option value="">{t("noLink")}</option>
            {links.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="subject" className="block text-sm text-text-soft">
          {t("subject")}
        </label>
        <Input id="subject" name="subject" required minLength={3} maxLength={140} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="body" className="block text-sm text-text-soft">
          {t("message")}
        </label>
        <textarea
          id="body"
          name="body"
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          aria-describedby="body-hint"
          className={area}
        />
        <p id="body-hint" className="text-xs text-muted-foreground">
          {t("messageHint")}
        </p>
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-danger">
          {r(state.key)}
        </p>
      ) : null}
      <Button type="submit" pending={pending}>
        {t("sendRequest")}
      </Button>
    </form>
  );
}

export function Reply({ ticketId }: { ticketId: string }) {
  const t = useTranslations("support");
  const r = useTranslations("results");
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    replyTicket.bind(null, ticketId),
    null,
  );
  return (
    <form action={action} className="space-y-3" key={state?.ok ? "sent" : "draft"}>
      <label htmlFor="reply" className="block text-sm text-text-soft">
        {t("replyLabel")}
      </label>
      <textarea id="reply" name="body" required maxLength={5000} rows={4} className={area} />
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-danger">
          {r(state.key)}
        </p>
      ) : null}
      <Button type="submit" pending={pending}>
        {t("sendReply")}
      </Button>
    </form>
  );
}
