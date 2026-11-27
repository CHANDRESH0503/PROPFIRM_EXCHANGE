import { TitleIcon } from "@/components/layout/title-icon";
import { LifeBuoy } from "lucide-react";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOnboarded } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { NewTicket } from "./forms";

export const metadata: Metadata = { title: "Support" };

export default function SupportPage() {
  return (
    <Suspense fallback={<Skeleton className="h-72" />}>
      <Support />
    </Suspense>
  );
}

async function Support() {
  const { user } = await requireOnboarded("/support");
  const db = await createClient();
  const [t, tickets, claims] = await Promise.all([
    getTranslations("support"),
    db
      .from("support_tickets")
      .select("id,subject,status,updated_at")
      .order("updated_at", { ascending: false })
      .limit(30),
    db
      .from("purchase_claims")
      .select("id,order_ref")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (tickets.error || claims.error) throw new Error("support_unavailable");
  const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });
  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="flex items-center gap-3 text-2xl font-bold">
          <TitleIcon icon={LifeBuoy} hue="var(--positive)" />
          {t("memberTitle")}
        </h1>
        <p className="text-sm text-text-soft">
          {t("intro")}{" "}
          <Link href="/help" className="underline">
            {t("helpLink")}
          </Link>
        </p>
      </header>
      {tickets.data.length ? (
        <section aria-labelledby="your-tickets" className="space-y-3">
          <h2 id="your-tickets" className="text-lg font-semibold">
            {t("yours")}
          </h2>
          <ul className="divide-y divide-hairline rounded-2xl panel">
            {tickets.data.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/support/${s.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-raised"
                >
                  <span className="font-medium">{s.subject}</span>
                  <span className="text-sm text-muted-foreground">
                    {t(
                      `memberStatus.${s.status === "resolved" ? "resolved" : s.status === "waiting_on_user" ? "waiting_on_user" : "open"}`,
                    )}{" "}
                    · {date.format(new Date(s.updated_at))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section aria-labelledby="new-ticket" className="space-y-4">
        <h2 id="new-ticket" className="text-lg font-semibold">
          {t("new")}
        </h2>
        <NewTicket
          links={claims.data.map((c) => ({
            value: `claim:${c.id}`,
            label: t("claimLink", { ref: c.order_ref }),
          }))}
        />
      </section>
    </div>
  );
}
