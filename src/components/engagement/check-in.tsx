"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { checkIn } from "@/app/(app)/(shell)/today/actions";
export function CheckIn({ checked }: { checked: boolean }) {
  const t = useTranslations("today.checkIn");
  const [result, action, pending] = useActionState(checkIn, null);
  return (
    <form action={action} className="w-full">
      <Button
        block
        pending={pending}
        size="lg"
        variant={checked || result?.ok ? "secondary" : "primary"}
        disabled={checked || pending || result?.ok}
      >
        {t(checked || result?.ok ? "done" : pending ? "saving" : "button")}
      </Button>
      {result && (
        <p
          role="status"
          className={
            result.ok ? "mt-2 text-sm font-semibold text-xp-2" : "mt-2 text-sm text-danger"
          }
        >
          {result.ok ? t("earned", { xp: result.xp }) : t("failed")}
        </p>
      )}
    </form>
  );
}
