import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { recalculateAllUbr, processSessionUbr } from "@/lib/db/ubr";

/** POST — recalculate UBR ratings.
 *  Body: { session_id?: string }
 *  - If session_id provided: incremental update for that session
 *  - If no session_id: full recalculation from scratch (admin/god only)
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await supabase
    .from("players")
    .select("is_admin, is_god_mode")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!player?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const sessionId = body.session_id as string | undefined;
  const playerId = body.player_id as string | undefined;

  if (sessionId) {
    await processSessionUbr(sessionId);
    return NextResponse.json({ ok: true, mode: "incremental" });
  }

  // Per-player recalculation — admin only (full recalc under the hood)
  if (playerId) {
    await recalculateAllUbr();
    return NextResponse.json({ ok: true, mode: "full", triggered_by_player: playerId });
  }

  // Unscoped full recalculation — god mode only
  const isGodMode = (player as unknown as { is_god_mode?: boolean })?.is_god_mode ?? false;
  if (!isGodMode) {
    return NextResponse.json({ error: "Full recalculation requires god mode" }, { status: 403 });
  }

  await recalculateAllUbr();
  return NextResponse.json({ ok: true, mode: "full" });
}
