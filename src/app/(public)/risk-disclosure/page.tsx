import { TrustArticle, trustMetadata } from "@/components/trust/trust-article";

export const generateMetadata = () => trustMetadata("risk-disclosure");

export default function RiskDisclosurePage() {
  return <TrustArticle slug="risk-disclosure" />;
}
