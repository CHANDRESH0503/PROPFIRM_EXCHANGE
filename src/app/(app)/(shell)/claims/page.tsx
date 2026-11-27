import { TitleIcon } from "@/components/layout/title-icon";
import { Receipt } from "lucide-react";
import { FrozenNotice } from "@/components/layout/frozen-notice";
import { Suspense } from "react";
import Link from "next/link";
import { z } from "zod";
import { ActionForm } from "@/components/admin/action-form";
import { Labelled, areaClass } from "@/components/admin/form-fields";
import { appealClaim } from "./appeal-actions";
import { getNow, getTranslations } from "next-intl/server";
import { requireOnboarded } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { findPrograms, money } from "@/lib/catalogue/programs";
import { Skeleton } from "@/components/ui/skeleton";
import { ClaimForm } from "./claim-form";

export const metadata = { title: "Purchase claims" };
export default function Page(props: PageProps<"/claims">) {
  return (
    <Suspense fallback={<Skeleton className="h-72 rounded-lg" />}>
      <Claims {...props} />
    </Suspense>
  );
}
async function Claims({ searchParams }: PageProps<"/claims">) {
  const params = await searchParams;
  const selected = z.uuid().safeParse(params.program);
  const { user } = await requireOnboarded(
    selected.success ? "/claims?program=" + selected.data : "/claims",
  );
  const [t, at, now] = await Promise.all([
    getTranslations("purchase"),
    getTranslations("appeals"),
    getNow(),
  ]);
  const page = z.coerce.number().int().min(1).max(10000).catch(1).parse(params.page);
  const historyUrl = (n: number) =>
    `/claims?page=${n}${selected.success ? "&program=" + selected.data : ""}` as const;
  const db = await createClient();
  const [history, selection] = await Promise.all([
    db
      .from("purchase_claims")
      .select(
        "id,order_ref,status,created_at,reviewed_at,review_note,amount_paid_cents,currency,claim_appeals(status,evidence,decision_note)",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * 25, page * 25),
    selected.success ? findPrograms({}, { ids: [selected.data] }) : null,
  ]);
  if (history.error) throw new Error("claim_history_unavailable");
  const p = selection?.programs[0];
  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-3 text-2xl font-bold">
        <TitleIcon icon={Receipt} hue="var(--pink)" />
        {t("claims")}
      </h1>
      <FrozenNotice />
      {p && !p.is_sample && p.rebate_permission ? (
        <ClaimForm
          id={p.program_id}
          label={p.firm_name + " · " + p.program_name + " (" + p.currency + ")"}
        />
      ) : (
        <div className="space-y-2">
          <p className="text-text-soft">{t("chooseProgram")}</p>
          <Link className="inline-flex min-h-11 items-center underline" href="/firms">
            {t("browse")}
          </Link>
        </div>
      )}
      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("history")}</h2>
        {history.data.length ? (
          <ul className="divide-y divide-hairline border-y border-hairline">
            {history.data.slice(0, 25).map((c) => (
              <li key={c.id} className="py-4">
                <p className="font-mono">
                  {c.order_ref} · {money(c.amount_paid_cents, c.currency)}
                </p>
                <p>{t(`status.${c.status}` as Parameters<typeof t>[0])}</p>
                {c.claim_appeals?.status !== "overturned" && c.review_note && (
                  <p className="mt-1 text-text-soft">{c.review_note}</p>
                )}
                {c.claim_appeals ? (
                  <div className="mt-3 space-y-2">
                    <p className="font-medium">
                      {at(
                        `statuses.${c.claim_appeals.status as "pending" | "upheld" | "overturned"}`,
                      )}
                    </p>
                    {c.claim_appeals.decision_note && (
                      <p className="whitespace-pre-wrap">{c.claim_appeals.decision_note}</p>
                    )}
                    <details>
                      <summary className="min-h-11 cursor-pointer content-center underline">
                        {at("submittedEvidence")}
                      </summary>
                      <p className="whitespace-pre-wrap">{c.claim_appeals.evidence}</p>
                    </details>
                  </div>
                ) : (
                  c.status === "rejected" &&
                  c.reviewed_at &&
                  (Date.parse(c.reviewed_at) + 14 * 86400000 >= now.getTime() ? (
                    <details className="mt-2 max-w-xl">
                      <summary className="min-h-11 cursor-pointer content-center underline">
                        {at("start")}
                      </summary>
                      <p className="mb-3 text-sm text-muted-foreground">
                        {at("deadline", {
                          deadline: new Intl.DateTimeFormat("en-GB", {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: "UTC",
                          }).format(Date.parse(c.reviewed_at) + 14 * 86400000),
                        })}
                      </p>
                      <ActionForm action={appealClaim.bind(null, c.id)} submit={at("submit")}>
                        <Labelled label={at("evidence")}>
                          <textarea
                            className={areaClass}
                            name="evidence"
                            rows={3}
                            required
                            minLength={20}
                            maxLength={4000}
                          />
                        </Labelled>
                      </ActionForm>
                    </details>
                  ) : (
                    <p className="text-sm text-muted-foreground">{at("expired")}</p>
                  ))
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">{t("empty")}</p>
        )}
        <nav className="flex gap-4">
          {page > 1 && <Link href={historyUrl(page - 1)}>{t("previous")}</Link>}
          {history.data.length > 25 && <Link href={historyUrl(page + 1)}>{t("next")}</Link>}
        </nav>
      </section>
    </div>
  );
}
