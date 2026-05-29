import { NextRequest, NextResponse } from "next/server";
import { getAuthPlayer } from "@/lib/auth";
import { computeGlobalLeaderboard, setGlobalLeaderboardCache } from "@/lib/db/global-leaderboard";

export async function POST(req: NextRequest) {
  const authPlayer = await getAuthPlayer();
  if (!authPlayer?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const triggeredAt = (body.triggered_at as string | undefined) ?? new Date().toISOString();

  const payload = await computeGlobalLeaderboard();
  await setGlobalLeaderboardCache(payload, triggeredAt);

  return NextResponse.json({ ok: true, triggered_at: triggeredAt, computed_at: payload.computed_at });
}
