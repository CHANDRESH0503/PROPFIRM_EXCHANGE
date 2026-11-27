import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ConfirmDeletion } from "@/app/(app)/(shell)/profile/data/forms";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Confirm account deletion",
  robots: { index: false, follow: false },
};

/** Opened from the email. A button confirms, so link scanners that follow the URL change nothing. */
export default function ConfirmDeletePage(props: PageProps<"/account/delete">) {
  return (
    <Suspense fallback={<Skeleton className="h-40" />}>
      <Confirm {...props} />
    </Suspense>
  );
}

async function Confirm({ searchParams }: PageProps<"/account/delete">) {
  const token = (await searchParams).token;
  await requireUser(`/account/delete?token=${typeof token === "string" ? token : ""}`);
  const t = await getTranslations("dataRights");
  return (
    <div className="space-y-5">
      <h1 className="font-heading text-2xl font-bold">{t("confirmTitle")}</h1>
      <p className="text-text-soft">{t("confirmBody")}</p>
      {typeof token === "string" ? (
        <ConfirmDeletion token={token} />
      ) : (
        <p role="alert" className="text-danger">
          {t("badLink")}
        </p>
      )}
    </div>
  );
}
