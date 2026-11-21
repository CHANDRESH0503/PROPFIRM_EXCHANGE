import { TrustArticle, trustMetadata } from "@/components/trust/trust-article";

export const generateMetadata = () => trustMetadata("how-we-rank-firms");

export default function HowWeRankFirmsPage() {
  return <TrustArticle slug="how-we-rank-firms" />;
}
