"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { chooseReward, revealVoucher } from "./actions";

export function RewardControls({
  id,
  nonce,
  cost,
  canSpend,
  goal,
}: {
  id: string;
  nonce: string;
  cost: number;
  canSpend: boolean;
  goal: boolean;
}) {
  const t = useTranslations("shop");
  const [result, action, pending] = useActionState(chooseReward, "");
  return (
    <form className="mt-4 flex flex-wrap items-start gap-3" action={action}>
      <input type="hidden" name="reward" value={id} />
      <input type="hidden" name="request" value={nonce} />
      <input type="hidden" name="cost" value={cost} />
      {canSpend && (
        <details>
          <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-primary px-4 text-primary-foreground">
            {t("redeem")}
          </summary>
          <p className="my-3 text-sm">{t("confirmBody", { cost: cost.toLocaleString("en-US") })}</p>
          <Button name="intent" value="redeem" pending={pending}>
            {t("confirm")}
          </Button>
        </details>
      )}
      <Button variant="secondary" name="intent" value="goal" disabled={goal} pending={pending}>
        {t(goal ? "currentGoal" : "goal")}
      </Button>
      {result && (
        <p role="status" className="w-full text-sm">
          {t(result as "changed" | "goalSaved" | "insufficient" | "held" | "limited" | "redeemed")}
        </p>
      )}
    </form>
  );
}

export function RevealCode({ id }: { id: string }) {
  const t = useTranslations("shop");
  const [result, action, pending] = useActionState(revealVoucher, null);
  return (
    <form action={action} className="mt-2">
      <input type="hidden" name="id" value={id} />
      {result && "value" in result ? (
        <output className="block rounded-md border border-hairline p-3 font-mono break-all select-all">
          {result.value}
        </output>
      ) : (
        <Button variant="secondary" pending={pending}>
          {t("reveal")}
        </Button>
      )}
      {result && "error" in result && <p role="alert">{t("revealError")}</p>}
    </form>
  );
}
