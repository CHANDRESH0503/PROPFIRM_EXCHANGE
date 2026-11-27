import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { requireReviewer } from "@/lib/auth/reviewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionForm } from "@/components/admin/action-form";
import { Labelled, inputClass, areaClass } from "@/components/admin/form-fields";
import { reviewTicket } from "./actions";
export default function Page(props: PageProps<"/admin/support/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-72" />}>
      <Thread {...props} />
    </Suspense>
  );
}
async function Thread({ params }: PageProps<"/admin/support/[id]">) {
  await requireReviewer();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const db = createAdminClient();
  const [t, ticket, messages] = await Promise.all([
    getTranslations("support"),
    db.from("support_tickets").select("subject,status").eq("id", id.data).maybeSingle(),
    db
      .from("support_messages")
      .select("id,body,internal,from_staff")
      .eq("ticket_id", id.data)
      .order("id"),
  ]);
  if (ticket.error || messages.error) throw new Error("support_unavailable");
  if (!ticket.data) notFound();
  return (
    <div className="space-y-5">
      <Link className="underline" href="/admin/support">
        {t("queue")}
      </Link>
      <h1 className="text-2xl font-bold">{ticket.data.subject}</h1>
      <ol className="divide-y divide-hairline">
        {messages.data.map((m) => (
          <li key={m.id} className="py-3">
            <strong>{t(m.internal ? "notes" : m.from_staff ? "staff" : "member")}</strong>
            <p className="whitespace-pre-wrap">{m.body}</p>
          </li>
        ))}
      </ol>
      <ActionForm action={reviewTicket.bind(null, id.data)} submit={t("save")} resetOnSuccess>
        <Labelled label={t("message")}>
          <textarea className={areaClass} name="body" maxLength={5000} />
        </Labelled>
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" name="internal" />
          {t("internal")}
        </label>
        <Labelled label={t("status")}>
          <select name="status" className={inputClass} defaultValue={ticket.data.status}>
            {(["open", "waiting_on_user", "resolved"] as const).map((k) => (
              <option key={k} value={k}>
                {t(`statuses.${k}`)}
              </option>
            ))}
          </select>
        </Labelled>
      </ActionForm>
    </div>
  );
}
