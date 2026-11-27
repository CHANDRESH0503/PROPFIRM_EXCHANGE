import { recordMissionEvent } from "@/lib/engagement/missions";
import { getNow } from "next-intl/server";
import { getProfile, getSessionUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/http/rate-limit";
import { RecordOnView } from "./record-on-view";

/** Only a qualifying server-rendered result can issue this user- and day-bound action. */
export async function MissionVisit({ event }: { event: "deals_viewed" | "programs_compared" }) {
  const profile = await getProfile();
  if (!profile?.onboarded_at || !profile.timezone) return null;
  const userId = profile.id,
    zone = profile.timezone;
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(await getNow());
  async function record() {
    "use server";
    if (
      (await getSessionUser())?.id !== userId ||
      new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(new Date()) !== day
    )
      return;
    if (!(await rateLimit("mission", userId))) return;
    await recordMissionEvent(userId, event);
  }
  return <RecordOnView record={record} />;
}
