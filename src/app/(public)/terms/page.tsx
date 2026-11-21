import { TrustArticle, trustMetadata } from "@/components/trust/trust-article";

export const generateMetadata = () => trustMetadata("terms");

export default function TermsPage() {
  return <TrustArticle slug="terms" />;
}
