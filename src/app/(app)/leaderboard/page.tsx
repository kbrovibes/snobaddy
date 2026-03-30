export const dynamic = "force-dynamic";

import { getAllPlayers } from "@/lib/db/players";
import LeaderboardTable from "./LeaderboardTable";

export default async function LeaderboardPage() {
  const players = await getAllPlayers();

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Leaderboard</h1>
        <span className="text-sm text-gray-400">{players.length} players</span>
      </div>
      <LeaderboardTable players={players} />
    </div>
  );
}
