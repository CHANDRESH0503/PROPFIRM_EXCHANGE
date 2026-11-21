import { TrustArticle, trustMetadata } from "@/components/trust/trust-article";

export const generateMetadata = () => trustMetadata("rewards-terms");

export default function RewardsTermsPage() {
  return <TrustArticle slug="rewards-terms" />;
}
