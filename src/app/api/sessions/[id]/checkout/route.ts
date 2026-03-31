import { createClient } from "@/lib/supabase-server";
import { replacePlayerInProposedMatches } from "@/lib/db/proposed";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: currentPlayer } = await supabase
    .from("players").select("id, is_admin").eq("user_id", user.id).single();
  if (!currentPlayer) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // Admin can check out any player; others can only check out themselves
  const body = await request.json().catch(() => ({}));
  const targetPlayerId =
    currentPlayer.is_admin && body.player_id ? body.player_id : currentPlayer.id;

  const { id } = await params;
  const { error } = await supabase
    .from("session_players")
    .update({ checked_out_at: new Date().toISOString() })
    .eq("session_id", id)
    .eq("player_id", targetPlayerId)
    .is("checked_out_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update any proposed matches that include the departed player
  await replacePlayerInProposedMatches(id, targetPlayerId);

  return NextResponse.json({ ok: true });
}
