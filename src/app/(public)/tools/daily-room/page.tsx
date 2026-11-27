import { ToolPage, toolMetadata } from "@/components/tools/tool-page";

export const generateMetadata = () => toolMetadata("daily-room");

export default function Page({ searchParams }: PageProps<"/tools/daily-room">) {
  return <ToolPage tool="daily-room" searchParams={searchParams} />;
}
