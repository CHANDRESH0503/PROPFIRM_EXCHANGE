import { getTranslations } from "next-intl/server";

export interface AuditRow {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  reason: string | null;
  created_at: string;
}

const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/** Read-only audit rows. Actor ids are shortened; the full id is in the title for copying. */
export async function AuditTable({ rows }: { rows: AuditRow[] }) {
  const t = await getTranslations("admin.audit.columns");
  return (
    <div className="overflow-x-auto rounded-xl border border-hairline">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="bg-surface text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">{t("when")} (UTC)</th>
            <th scope="col" className="px-4 py-3 font-medium">{t("actor")}</th>
            <th scope="col" className="px-4 py-3 font-medium">{t("action")}</th>
            <th scope="col" className="px-4 py-3 font-medium">{t("entity")}</th>
            <th scope="col" className="px-4 py-3 font-medium">{t("reason")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 whitespace-nowrap text-text-soft tabular">{when.format(new Date(r.created_at))}</td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground" title={r.actor_id ?? "system"}>
                {r.actor_id ? r.actor_id.slice(0, 8) : "system"}
              </td>
              <td className="px-4 py-3 font-mono text-xs">{r.action}</td>
              <td className="px-4 py-3 text-text-soft">
                {r.entity_type}
                {r.entity_id ? <span className="ml-1 font-mono text-xs text-muted-foreground">{r.entity_id}</span> : null}
              </td>
              <td className="px-4 py-3 text-text-soft">{r.reason ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
