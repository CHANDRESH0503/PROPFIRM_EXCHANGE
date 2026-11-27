import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOnboarded } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { Reply } from "../forms";

export const metadata: Metadata = { title: "Support request" };

export default function TicketPage(props: PageProps<"/support/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-72" />}>
      <Ticket {...props} />
    </Suspense>
  );
}

async function Ticket({ params }: PageProps<"/support/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  await requireOnboarded(`/support/${id}`);
  const db = await createClient();
  const [t, ticket, messages] = await Promise.all([
    getTranslations("support"),
    db.from("support_tickets").select("id,subject,status,created_at").eq("id", id).maybeSingle(),
    db
      .from("support_messages")
      .select("id,from_staff,body,created_at")
      .eq("ticket_id", id)
      .order("id"),
  ]);
  if (ticket.error || messages.error) throw new Error("support_unavailable");
  if (!ticket.data) notFound();
  const date = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  const status =
    ticket.data.status === "resolved"
      ? "resolved"
      : ticket.data.status === "waiting_on_user"
        ? "waiting_on_user"
        : "open";
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link
        href="/support"
        className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline"
      >
        {t("back")}
      </Link>
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{ticket.data.subject}</h1>
        <p className="text-sm text-muted-foreground">{t(`memberStatus.${status}`)}</p>
      </header>
      <ol className="space-y-4">
        {messages.data.map((m) => (
          <li
            key={m.id}
            className={cn(
              "rounded-xl border p-4",
              m.from_staff ? "border-hairline bg-surface" : "border-hairline",
            )}
          >
            <p className="text-xs text-muted-foreground">
              {m.from_staff ? t("fromSupport") : t("fromYou")} ·{" "}
              {date.format(new Date(m.created_at))}
            </p>
            <p className="mt-2 whitespace-pre-wrap">{m.body}</p>
          </li>
        ))}
      </ol>
      <Reply ticketId={id} />
    </div>
  );
}
