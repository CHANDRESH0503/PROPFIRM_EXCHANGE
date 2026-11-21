import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Gift, ShieldCheck, Tag } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireOnboarded } from "@/lib/auth/session";

const ICONS = { deals: Tag, rewards: Gift, accounts: ShieldCheck };

/** Tab placeholder until its phase ships: says what will be here, and leads back to Today. */
export async function ComingSoon({ section }: { section: keyof typeof ICONS }) {
  await requireOnboarded(`/${section}`);
  const [t, tabs] = await Promise.all([getTranslations("placeholder"), getTranslations("nav.tabs")]);
  const Icon = ICONS[section];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{tabs(section)}</h1>
      <EmptyState
        icon={<Icon />}
        title={t("soonTitle", { section: tabs(section) })}
        body={t(section)}
        action={
          <Link href="/today" className={buttonVariants({ variant: "secondary" })}>
            {t("back")}
          </Link>
        }
      />
    </div>
  );
}
