import { getActivePlayers } from "@/lib/db/players";
import { getSeasonMatchCount } from "@/lib/db/matches";
import { getAllUbrRatings, type UbrRating } from "@/lib/db/ubr";
import { getAppSetting } from "@/lib/db/settings";
import { createClient } from "@/lib/supabase-server";
import LeaderboardTable from "./LeaderboardTable";

export default async function LeaderboardData({
  seasonId,
  seasonLockDate,
  isAdmin,
}: {
  seasonId: string | undefined;
  seasonLockDate: string | null;
  isAdmin: boolean;
}) {
  const supabase = await createClient();
  const [allPlayers, totalMatches, ubrMap, ubrEnabledSetting, lockedSessionsResult] = await Promise.all([
    getActivePlayers({ seasonId, seasonLockDate }),
    getSeasonMatchCount({ seasonId, seasonLockDate }),
    getAllUbrRatings(),
    getAppSetting("ubr_enabled"),
    seasonId && seasonLockDate
      ? supabase
          .from("sessions")
          .select("id", { count: "exact", head: true })
          .eq("season_id", seasonId)
          .eq("is_test_session", false)
          .gt("date", seasonLockDate)
      : Promise.resolve({ count: 0, data: null, error: null }),
  ]);
  const lockedSessionCount = (lockedSessionsResult as { count: number | null }).count ?? 0;

  const ubrEnabled = ubrEnabledSetting === "true";
  const ubrRatings: Record<string, UbrRating> = {};
  for (const [k, v] of ubrMap) {
    ubrRatings[k] = v;
  }

  return (
    <LeaderboardTable
      players={allPlayers.filter(p => p.matches_played > 0)}
      totalMatches={totalMatches}
      isAdmin={isAdmin}
      ubrRatings={ubrEnabled ? ubrRatings : undefined}
      lockedSessionCount={lockedSessionCount}
    />
  );
}
