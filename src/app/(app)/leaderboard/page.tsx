export const dynamic = "force-dynamic";

import { getActivePlayers } from "@/lib/db/players";
import { getSeasonMatchCount } from "@/lib/db/matches";
import { getAllUbrRatings, type UbrRating } from "@/lib/db/ubr";
import { getAppSetting } from "@/lib/db/settings";
import { getActiveSeason } from "@/lib/db/seasons";
import LeaderboardTable from "./LeaderboardTable";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: currentPlayer } = await supabase
    .from("players").select("is_admin").eq("user_id", user!.id).maybeSingle();
  const isAdmin = currentPlayer?.is_admin ?? false;

  if (!isAdmin) redirect("/");

  const activeSeason = await getActiveSeason();
  const seasonId = activeSeason?.id;

  // Season-scoped: W/L stats are per-season. UBR ratings are all-time (cross-season).
  const [allPlayers, totalMatches, ubrMap, ubrEnabledSetting] = await Promise.all([
    getActivePlayers({ seasonId }),
    getSeasonMatchCount({ seasonId }),
    getAllUbrRatings(),       // UBR is all-time — never season-scoped
    getAppSetting("ubr_enabled"),
  ]);

  const ubrEnabled = ubrEnabledSetting === "true";
  // Convert Map to plain object for client component serialization
  const ubrRatings: Record<string, UbrRating> = {};
  for (const [k, v] of ubrMap) {
    ubrRatings[k] = v;
  }

  return (
    <div className="px-4 py-4 pb-20">
      <h1 className="text-xs font-semibold uppercase tracking-wide text-muted-light mb-4 px-1">Leaderboard</h1>

      <LeaderboardTable
        players={allPlayers.filter(p => p.matches_played > 0)}
        totalMatches={totalMatches}
        isAdmin={isAdmin}
        ubrRatings={ubrEnabled ? ubrRatings : undefined}
      />
    </div>
  );
}
