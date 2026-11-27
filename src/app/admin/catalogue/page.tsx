import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { kinds } from "@/lib/catalogue/editor";
import { EditorForm, type FormValues } from "./editor-form";

export const metadata = { title: "Catalogue editor" };
export default function Page(props: PageProps<"/admin/catalogue">) {
  return (
    <Suspense fallback={<Skeleton className="h-72 rounded-lg" />}>
      <Catalogue {...props} />
    </Suspense>
  );
}
const query = z.object({
  id: z.uuid().optional(),
  firm: z.uuid().optional(),
  kind: z.enum(kinds).optional(),
  duplicate: z.literal("1").optional(),
  saved: z.literal("1").optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
async function Catalogue({ searchParams }: PageProps<"/admin/catalogue">) {
  await requireStaff("content");
  const parsed = query.safeParse(await searchParams);
  if (!parsed.success) notFound();
  const { id, kind, firm, duplicate, saved, page } = parsed.data;
  const db = createAdminClient();
  const t = await getTranslations("editor");
  if (!kind) {
    const { data, count, error } = await db
      .from("firms")
      .select("id,name,status,published_at", { count: "exact" })
      .order("name")
      .order("id")
      .range((page - 1) * 40, page * 40 - 1);
    if (error) throw new Error("catalogue_unavailable");
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <Link
            href="/admin/catalogue?kind=firm"
            className="inline-flex min-h-11 items-center underline"
          >
            {t("newFirm")}
          </Link>
        </div>
        <ul className="divide-y divide-hairline border-y border-hairline">
          {data.map((f) => (
            <li key={f.id}>
              <Link
                href={`/admin/catalogue?kind=firm&id=${f.id}`}
                className="flex min-h-14 items-center justify-between gap-4"
              >
                <span>{f.name}</span>
                <span className="text-sm text-muted-foreground">
                  {t(`choice.${f.status}` as Parameters<typeof t>[0])}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {!data.length && <p>{t("empty")}</p>}
        <nav className="flex gap-6">
          {page > 1 && <Link href={`/admin/catalogue?page=${page - 1}`}>{t("previous")}</Link>}
          {(count ?? 0) > page * 40 && (
            <Link href={`/admin/catalogue?page=${page + 1}`}>{t("next")}</Link>
          )}
        </nav>
      </div>
    );
  }
  let values: FormValues = {
    id: null,
    revision: 0,
    currency: "USD",
    commission_bps: 0,
    status: "active",
    drawdown_type: "static",
  };
  let parent = firm;
  if (id) {
    const table = kind === "firm" ? "firms" : kind === "program" ? "firm_programs" : "offers";
    const { data, error } = await db.from(table).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error("catalogue_unavailable");
    if (!data) notFound();
    const { rules, ...rest } = { rules: null, ...data } as typeof data & { rules: unknown };
    values = { ...rest, rules: JSON.stringify(rules || {}) } as FormValues;
    parent = kind === "firm" ? id : String(values.firm_id);
    if (kind === "firm") {
      const agreement = await db
        .from("firm_agreements")
        .select("tracking_url,promo_code,commission_bps,rebate_permission,evidence_url")
        .eq("firm_id", id)
        .maybeSingle();
      if (agreement.error) throw new Error("agreement_unavailable");
      values = {
        ...values,
        commission_bps: 0,
        ...agreement.data,
        platforms: Array.isArray(values.platforms) ? values.platforms.join(", ") : "",
      };
    }
    if (kind === "offer") {
      const targets = await db.from("offer_programs").select("program_id").eq("offer_id", id);
      if (targets.error) throw new Error("assignments_unavailable");
      values.program_ids = targets.data.map((p) => p.program_id);
    }
    if (duplicate && kind === "program")
      values = { ...values, id: null, revision: 0, published_at: null };
  }
  if (kind !== "firm" && !parent) notFound();
  const [programs, offers, parentFirm] = await Promise.all([
    parent ? db.from("firm_programs").select("id,name").eq("firm_id", parent).order("name") : null,
    parent && kind === "firm"
      ? db.from("offers").select("id,title").eq("firm_id", parent).order("title")
      : null,
    parent ? db.from("firms").select("name").eq("id", parent).maybeSingle() : null,
  ]);
  if (programs?.error || offers?.error || parentFirm?.error)
    throw new Error("catalogue_unavailable");
  if (parent && !parentFirm?.data) notFound();
  if (kind !== "firm") values.firm_id = parent!;
  return (
    <div className="max-w-3xl space-y-6">
      <Link
        className="inline-flex min-h-11 items-center underline"
        href={kind !== "firm" ? `/admin/catalogue?kind=firm&id=${parent}` : "/admin/catalogue"}
      >
        {kind === "firm" ? t("title") : parentFirm?.data?.name}
      </Link>
      <h1 className="text-2xl font-bold">
        {t(
          kind === "firm"
            ? id
              ? "editFirm"
              : "newFirm"
            : kind === "offer"
              ? id
                ? "editOffer"
                : "newOffer"
              : values.id
                ? "editProgram"
                : "newProgram",
        )}
      </h1>
      {saved && (
        <p role="status" className="text-positive">
          {t("saved")}
        </p>
      )}
      {kind === "firm" && id && (
        <section className="space-y-3 border-y border-hairline py-4">
          <h2 className="font-semibold">{t("children")}</h2>
          <ul className="divide-y divide-hairline">
            {programs?.data?.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <Link
                  className="inline-flex min-h-11 items-center underline"
                  href={`/admin/catalogue?kind=program&id=${p.id}`}
                >
                  {p.name}
                </Link>
                <Link
                  className="inline-flex min-h-11 items-center underline"
                  href={`/admin/catalogue?kind=program&id=${p.id}&duplicate=1`}
                >
                  {t("duplicate")}
                </Link>
              </li>
            ))}
            {offers?.data?.map((o) => (
              <li key={o.id}>
                <Link
                  className="inline-flex min-h-11 items-center underline"
                  href={`/admin/catalogue?kind=offer&id=${o.id}`}
                >
                  {o.title}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex gap-5">
            <Link
              className="inline-flex min-h-11 items-center underline"
              href={`/admin/catalogue?kind=program&firm=${id}`}
            >
              {t("newProgram")}
            </Link>
            {!!programs?.data?.length && (
              <Link
                className="inline-flex min-h-11 items-center underline"
                href={`/admin/catalogue?kind=offer&firm=${id}`}
              >
                {t("newOffer")}
              </Link>
            )}
          </div>
        </section>
      )}
      <EditorForm
        key={kind + String(id) + String(values.revision)}
        kind={kind}
        values={values}
        programs={programs?.data ?? []}
      />
    </div>
  );
}
