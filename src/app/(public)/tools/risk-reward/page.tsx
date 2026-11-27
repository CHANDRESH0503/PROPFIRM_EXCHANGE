import { ToolPage, toolMetadata } from "@/components/tools/tool-page";

export const generateMetadata = () => toolMetadata("risk-reward");

export default function Page({ searchParams }: PageProps<"/tools/risk-reward">) {
  return <ToolPage tool="risk-reward" searchParams={searchParams} />;
}
