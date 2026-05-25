import { NextRequest, NextResponse } from "next/server";
import { computeGlobalLeaderboard, setGlobalLeaderboardCache } from "@/lib/db/global-leaderboard";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await computeGlobalLeaderboard();
  await setGlobalLeaderboardCache(payload);

  return NextResponse.json({
    ok: true,
    players: payload.players.length,
    computed_at: payload.computed_at,
  });
}
