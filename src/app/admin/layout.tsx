import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/brand/wordmark";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

/**
 * Admin chrome only. Authorisation happens in every page (requireStaff), never here, so a
 * page can't be reached by skipping the layout and the MFA page can sit inside it.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("admin");
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-hairline/70 bg-ink-deep/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-5 sm:px-8">
          <Wordmark href="/admin" />
          <span className="rounded-full bg-beam px-2.5 py-0.5 text-xs font-bold text-white">
            {t("title")}
          </span>
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-6 sm:px-8 md:grid-cols-[12rem_1fr] md:gap-10 md:py-10">
        <Suspense fallback={<Skeleton className="h-11 rounded-lg md:h-80" />}>
          <AdminNav />
        </Suspense>
        <main id="main" className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
