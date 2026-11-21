import { TrustArticle, trustMetadata } from "@/components/trust/trust-article";

export const generateMetadata = () => trustMetadata("privacy");

export default function PrivacyPage() {
  return <TrustArticle slug="privacy" />;
}
