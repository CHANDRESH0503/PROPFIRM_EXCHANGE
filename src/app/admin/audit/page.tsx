import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AuditTable } from "@/components/admin/audit-table";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Audit log" };

export default function AuditPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <Audit />
    </Suspense>
  );
}

async function Audit() {
  await requireStaff();
  const [nav, t] = await Promise.all([getTranslations("admin.nav"), getTranslations("admin.audit")]);
  const { data, error } = await createAdminClient()
    .from("audit_log")
    .select("id, actor_id, action, entity_type, entity_id, reason, created_at")
    .order("id", { ascending: false })
    .limit(200);
  if (error) throw new Error(`audit_log: ${error.code}`);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{nav("audit")}</h1>
      {data.length ? <AuditTable rows={data} /> : <p className="text-sm text-muted-foreground">{t("empty")}</p>}
    </div>
  );
}
