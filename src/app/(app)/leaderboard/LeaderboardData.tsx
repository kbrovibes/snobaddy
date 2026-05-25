import { getActivePlayers, type PlayerStats } from "@/lib/db/players";
import { getSeasonMatchCount } from "@/lib/db/matches";
import { getAllUbrRatings, type UbrRating } from "@/lib/db/ubr";
import { getAppSetting } from "@/lib/db/settings";
import { createClient } from "@/lib/supabase-server";
import {
  computeLeaderboardSignature,
  getCachedLeaderboard,
  setCachedLeaderboard,
} from "@/lib/db/leaderboard-cache";
import LeaderboardTable from "./LeaderboardTable";

interface CachedData {
  players: PlayerStats[];
  totalMatches: number;
  ubrRatings: Record<string, UbrRating> | undefined;
  lockedSessionCount: number;
}

async function computeLeaderboardData(
  seasonId: string | undefined,
  seasonLockDate: string | null
): Promise<CachedData> {
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

  return {
    players: allPlayers.filter(p => p.matches_played > 0),
    totalMatches,
    ubrRatings: ubrEnabled ? ubrRatings : undefined,
    lockedSessionCount,
  };
}

export default async function LeaderboardData({
  seasonId,
  seasonLockDate,
  isAdmin,
  showFullNames = false,
  sectionLabel,
}: {
  seasonId: string | undefined;
  seasonLockDate: string | null;
  isAdmin: boolean;
  showFullNames?: boolean;
  sectionLabel?: string;
}) {
  let data: CachedData;

  if (seasonId) {
    const signature = await computeLeaderboardSignature(seasonId, seasonLockDate);
    const cached = await getCachedLeaderboard(seasonId, signature) as CachedData | null;

    if (cached) {
      data = cached;
    } else {
      data = await computeLeaderboardData(seasonId, seasonLockDate);
      // Fire-and-forget cache write
      setCachedLeaderboard(seasonId, signature, data).catch(() => {});
    }
  } else {
    data = await computeLeaderboardData(seasonId, seasonLockDate);
  }

  return (
    <LeaderboardTable
      players={data.players}
      totalMatches={data.totalMatches}
      isAdmin={isAdmin}
      ubrRatings={data.ubrRatings}
      lockedSessionCount={data.lockedSessionCount}
      showFullNames={showFullNames}
      sectionLabel={sectionLabel}
    />
  );
}
