import { Suspense } from "react";
import { forbidden, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { getRoles, hasRole, requireUser } from "@/lib/auth/session";
import { MfaForm } from "./mfa-form";

export const metadata = { title: "Two-factor authentication" };

export default function MfaPage() {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full max-w-md rounded-xl" />}>
      <Mfa />
    </Suspense>
  );
}

async function Mfa() {
  const user = await requireUser("/admin/mfa");
  if (!hasRole(await getRoles())) forbidden();
  if (user.aal === "aal2") redirect("/admin");
  const t = await getTranslations("admin.mfa");
  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <MfaForm />
    </div>
  );
}
