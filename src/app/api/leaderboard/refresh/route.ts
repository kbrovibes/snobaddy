import { NextResponse } from "next/server";
import { getAuthPlayer } from "@/lib/auth";
import { getActiveSeason } from "@/lib/db/seasons";
import { invalidateLeaderboardCache } from "@/lib/db/leaderboard-cache";

export async function POST() {
  const authPlayer = await getAuthPlayer();
  if (!authPlayer?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const season = await getActiveSeason();
  if (season) {
    await invalidateLeaderboardCache(season.id);
  }

  return NextResponse.json({ ok: true });
}
