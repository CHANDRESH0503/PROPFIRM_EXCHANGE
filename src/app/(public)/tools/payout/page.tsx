import { ToolPage, toolMetadata } from "@/components/tools/tool-page";

export const generateMetadata = () => toolMetadata("payout");

export default function Page({ searchParams }: PageProps<"/tools/payout">) {
  return <ToolPage tool="payout" searchParams={searchParams} />;
}
