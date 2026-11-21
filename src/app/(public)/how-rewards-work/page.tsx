import { TrustArticle, trustMetadata } from "@/components/trust/trust-article";

export const generateMetadata = () => trustMetadata("how-rewards-work");

export default function HowRewardsWorkPage() {
  return <TrustArticle slug="how-rewards-work" />;
}
