import { ToolPage, toolMetadata } from "@/components/tools/tool-page";

export const generateMetadata = () => toolMetadata("drawdown-recovery");

export default function Page({ searchParams }: PageProps<"/tools/drawdown-recovery">) {
  return <ToolPage tool="drawdown-recovery" searchParams={searchParams} />;
}
