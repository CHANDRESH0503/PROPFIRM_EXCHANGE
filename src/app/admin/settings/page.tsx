import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { hasRole, requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { FlagRow } from "./flag-row";

export const metadata = { title: "Feature flags" };

/** Flags whose subject is chance-based (CLAUDE.md §2.9): shown with a warning. */
const CHANCE_FLAGS = new Set(["spins", "draws"]);

export default function SettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const { roles } = await requireStaff();
  const [t, nav] = await Promise.all([
    getTranslations("admin.flags"),
    getTranslations("admin.nav"),
  ]);
  const { data, error } = await createAdminClient()
    .from("feature_flags")
    .select("key, enabled, description, updated_at")
    .order("key");
  if (error) throw new Error(`feature_flags: ${error.code}`);
  const canEdit = hasRole(roles, "owner");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{nav("flags")}</h1>
        <p className="measure text-sm text-muted-foreground">
          {canEdit ? t("intro") : t("ownerOnly")}
        </p>
      </div>
      <ul className="divide-y divide-hairline rounded-2xl panel">
        {data.map((flag) => (
          <FlagRow
            key={flag.key}
            flag={flag}
            canEdit={canEdit}
            chance={CHANCE_FLAGS.has(flag.key)}
          />
        ))}
      </ul>
    </div>
  );
}
