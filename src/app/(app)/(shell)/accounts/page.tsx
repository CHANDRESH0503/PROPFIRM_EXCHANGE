import { Suspense } from "react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Accounts" };

export default function AccountsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
      <ComingSoon section="accounts" />
    </Suspense>
  );
}
