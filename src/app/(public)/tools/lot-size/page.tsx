import { ToolPage, toolMetadata } from "@/components/tools/tool-page";

export const generateMetadata = () => toolMetadata("lot-size");

export default function Page({ searchParams }: PageProps<"/tools/lot-size">) {
  return <ToolPage tool="lot-size" searchParams={searchParams} />;
}
