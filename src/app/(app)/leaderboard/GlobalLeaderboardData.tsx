import { getGlobalLeaderboardCache, computeGlobalLeaderboard, setGlobalLeaderboardCache } from "@/lib/db/global-leaderboard";
import GlobalLeaderboardTable from "./GlobalLeaderboardTable";

export default async function GlobalLeaderboardData() {
  let payload = await getGlobalLeaderboardCache();

  // If no cache exists yet, compute on-demand (first load only)
  if (!payload) {
    payload = await computeGlobalLeaderboard();
    setGlobalLeaderboardCache(payload).catch(() => {});
  }

  return (
    <GlobalLeaderboardTable
      players={payload.players}
      computedAt={payload.triggered_at ?? payload.computed_at}
    />
  );
}
