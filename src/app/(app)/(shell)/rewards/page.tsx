import { Suspense } from "react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Rewards" };

export default function RewardsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
      <ComingSoon section="rewards" />
    </Suspense>
  );
}
