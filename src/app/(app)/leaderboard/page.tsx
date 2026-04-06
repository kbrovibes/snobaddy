export const dynamic = "force-dynamic";

import { getActivePlayers } from "@/lib/db/players";
import { getSeasonMatchCount } from "@/lib/db/matches";
import LeaderboardTable from "./LeaderboardTable";
import { createClient } from "@/lib/supabase-server";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: currentPlayer } = await supabase
    .from("players").select("is_admin").eq("user_id", user!.id).maybeSingle();
  const isAdmin = currentPlayer?.is_admin ?? false;

  const [allPlayers, allPlayersWithTest, totalMatches, totalMatchesWithTest] = await Promise.all([
    getActivePlayers(),
    getActivePlayers({ includeTestSessions: true }),
    getSeasonMatchCount(),
    getSeasonMatchCount({ includeTestSessions: true }),
  ]);

  return (
    <div className="px-4 py-4 pb-20">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Leaderboard</h1>

      <LeaderboardTable
        players={allPlayers.filter(p => p.matches_played > 0)}
        playersWithTest={allPlayersWithTest.filter(p => p.matches_played > 0)}
        totalMatches={totalMatches}
        totalMatchesWithTest={totalMatchesWithTest}
        isAdmin={isAdmin}
      />
    </div>
  );
}
