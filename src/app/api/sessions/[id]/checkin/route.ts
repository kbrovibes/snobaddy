import { createClient } from "@/lib/supabase-server";
import { backfillMatchQueue } from "@/lib/db/proposed";
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

  const { id } = await params;
  const { data: session } = await supabase
    .from("sessions").select("status").eq("id", id).single();
  if (session?.status !== "active") {
    return NextResponse.json({ error: "Session is not active" }, { status: 400 });
  }

  // Admin can check in any player; others check in themselves
  const body = await request.json().catch(() => ({}));
  const targetPlayerId =
    currentPlayer.is_admin && body.player_id ? body.player_id : currentPlayer.id;

  // If previously checked out, clear the checkout time instead of inserting
  const { data: existing } = await supabase
    .from("session_players")
    .select("id, checked_out_at")
    .eq("session_id", id)
    .eq("player_id", targetPlayerId)
    .maybeSingle();

  if (existing?.checked_out_at) {
    // Refresh check-in time so wait-time ordering reflects re-arrival
    await supabase
      .from("session_players")
      .update({ checked_out_at: null, checked_in_at: new Date().toISOString() })
      .eq("id", existing.id);
    backfillMatchQueue(id).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("session_players")
    .insert({ session_id: id, player_id: targetPlayerId });

  if (error?.code === "23505") return NextResponse.json({ ok: true, already: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  backfillMatchQueue(id).catch(() => {});
  return NextResponse.json({ ok: true });
}
