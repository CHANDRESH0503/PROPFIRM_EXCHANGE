import { TrustArticle, trustMetadata } from "@/components/trust/trust-article";

export const generateMetadata = () => trustMetadata("affiliate-disclosure");

export default function AffiliateDisclosurePage() {
  return <TrustArticle slug="affiliate-disclosure" />;
}
