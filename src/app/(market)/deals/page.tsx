import { MissionVisit } from "@/components/engagement/mission-visit";
import { Suspense } from "react";
import { Directory } from "@/components/catalogue/directory";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionUser } from "@/lib/auth/session";
import PublicLayout from "@/app/(public)/layout";
import ShellLayout from "@/app/(app)/(shell)/layout";
import type { Search } from "@/lib/catalogue/programs";

export const metadata = { title: "Deals" };
export default function Page({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-64 w-full max-w-5xl" />}>
      <Results search={searchParams} />
    </Suspense>
  );
}
async function Results({ search }: { search: Promise<Search> }) {
  const Layout = (await getSessionUser()) ? ShellLayout : PublicLayout;
  return (
    <Layout>
      <MissionVisit event="deals_viewed" />
      <Directory mode="deals" search={await search} />
    </Layout>
  );
}
