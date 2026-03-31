export const dynamic = "force-dynamic";

import { getAllPlayers } from "@/lib/db/players";
import { getSeasonMatchCount } from "@/lib/db/matches";
import LeaderboardTable from "./LeaderboardTable";

export default async function LeaderboardPage() {
  const [allPlayers, totalMatches] = await Promise.all([
    getAllPlayers(),
    getSeasonMatchCount(),
  ]);

  const activePlayers = allPlayers.filter(p => p.matches_played > 0);

  return (
    <div className="px-4 py-4 pb-20">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Leaderboard</h1>
        <span className="text-sm text-gray-400">{activePlayers.length} active players</span>
      </div>
      
      <LeaderboardTable players={activePlayers} />

      <div className="mt-8 pt-8 border-t border-gray-100 text-center">
        <div className="text-sm text-gray-400">
          Total matches recorded this season
        </div>
        <div className="text-2xl font-bold text-gray-900 mt-1">
          {totalMatches}
        </div>
      </div>
    </div>
  );
}
