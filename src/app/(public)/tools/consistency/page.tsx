import { ToolPage, toolMetadata } from "@/components/tools/tool-page";

export const generateMetadata = () => toolMetadata("consistency");

export default function Page({ searchParams }: PageProps<"/tools/consistency">) {
  return <ToolPage tool="consistency" searchParams={searchParams} />;
}
