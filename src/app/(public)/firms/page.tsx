import { Suspense } from "react";
import { Directory } from "@/components/catalogue/directory";
import { Skeleton } from "@/components/ui/skeleton";
import type { Search } from "@/lib/catalogue/programs";

export const metadata = { title: "Firm directory" };
export default function Page({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-64 w-full max-w-5xl" />}>
      <Results search={searchParams} />
    </Suspense>
  );
}
async function Results({ search }: { search: Promise<Search> }) {
  return <Directory mode="firms" search={await search} />;
}
