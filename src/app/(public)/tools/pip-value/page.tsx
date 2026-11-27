import { ToolPage, toolMetadata } from "@/components/tools/tool-page";

export const generateMetadata = () => toolMetadata("pip-value");

export default function Page({ searchParams }: PageProps<"/tools/pip-value">) {
  return <ToolPage tool="pip-value" searchParams={searchParams} />;
}
