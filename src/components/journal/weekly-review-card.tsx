import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { NotebookPen, Target } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { addDays } from "@/lib/journal/dates";
import { dayLabel } from "@/lib/journal/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Today's journal review strip: the rule set in last week's review (shown all week), and a prompt
 * when the current review is open and the member journaled that week. Renders nothing otherwise.
 */
export async function WeeklyReviewCard({ userId }: { userId: string }) {
  const [t, db] = await Promise.all([getTranslations("journal.review"), createClient()]);
  const week = await createAdminClient().rpc("journal_review_week", { p_user: userId });
  if (week.error || !week.data) return null;
  const start = week.data;
  const [reviews, traded] = await Promise.all([
    db
      .from("journal_reviews")
      .select("week_start,next_rule")
      .gte("week_start", addDays(start, -7))
      .order("week_start", { ascending: false }),
    db
      .from("journal_trades")
      .select("id", { count: "exact", head: true })
      .gte("local_day", start)
      .lte("local_day", addDays(start, 6)),
  ]);
  if (reviews.error || traded.error) return null;
  const rule = reviews.data.find((r) => r.next_rule)?.next_rule ?? null;
  const open = !reviews.data.some((r) => r.week_start === start) && (traded.count ?? 0) > 0;
  if (!rule && !open) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rule ? (
        <section
          aria-labelledby="week-rule"
          className="flex items-start gap-3 rounded-2xl border border-gold/40 bg-gold-soft p-4"
        >
          <Target className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden="true" />
          <div>
            <h2 id="week-rule" className="text-base text-gold">
              {t("todayRule")}
            </h2>
            <p className="mt-1 font-semibold text-foreground">{rule}</p>
            <p className="mt-1 text-xs text-text-soft">{t("todayRuleFrom")}</p>
          </div>
        </section>
      ) : null}
      {open ? (
        <section
          aria-labelledby="review-open"
          className="flex flex-wrap items-center gap-3 rounded-2xl p-4 panel"
        >
          <NotebookPen className="size-5 shrink-0 text-cyan" aria-hidden="true" />
          <div className="min-w-0 flex-1 basis-48">
            <h2 id="review-open" className="text-base">
              {t("todayOpen")}
            </h2>
            <p className="text-sm text-text-soft">
              {t("todayOpenBody", { start: dayLabel(start, "long") })}
            </p>
          </div>
          <Link href="/accounts/review" className={buttonVariants({ size: "md" })}>
            {t("todayStart")}
          </Link>
        </section>
      ) : null}
    </div>
  );
}
