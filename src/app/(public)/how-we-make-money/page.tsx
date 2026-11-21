import { TrustArticle, trustMetadata } from "@/components/trust/trust-article";

export const generateMetadata = () => trustMetadata("how-we-make-money");

export default function HowWeMakeMoneyPage() {
  return <TrustArticle slug="how-we-make-money" />;
}
