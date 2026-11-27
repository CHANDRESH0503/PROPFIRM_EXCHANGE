import { ToolPage, toolMetadata } from "@/components/tools/tool-page";

export const generateMetadata = () => toolMetadata("challenge-cost");

export default function Page({ searchParams }: PageProps<"/tools/challenge-cost">) {
  return <ToolPage tool="challenge-cost" searchParams={searchParams} />;
}
