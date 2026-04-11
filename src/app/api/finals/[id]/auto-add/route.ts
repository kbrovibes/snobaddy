import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";
import { getActivePlayers } from "@/lib/db/players";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await supabase
    .from("players")
    .select("id, is_god_mode")
    .eq("user_id", user.id)
    .single();
  if (!(player as unknown as { is_god_mode?: boolean } | null)?.is_god_mode) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const { data: event } = await supabase
    .from("finals_events")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (event.status !== "draft") {
    return NextResponse.json(
      { error: "Cannot add players after groups have been confirmed" },
      { status: 409 }
    );
  }

  // Get all active players who have any season record (wins + losses > 0)
  const allPlayers = await getActivePlayers();
  const eligible = allPlayers.filter((p) => p.wins + p.losses > 0);

  if (eligible.length === 0) {
    return NextResponse.json({ added: 0 });
  }

  // Get existing participants to avoid duplicates
  const { data: existing } = await supabase
    .from("finals_participants")
    .select("player_id")
    .eq("finals_event_id", id);

  const existingIds = new Set((existing ?? []).map((r) => r.player_id));
  const toAdd = eligible.filter((p) => !existingIds.has(p.id));

  if (toAdd.length === 0) {
    return NextResponse.json({ added: 0 });
  }

  const rows = toAdd.map((p) => ({
    finals_event_id: id,
    player_id: p.id,
    added_by: (player as unknown as { id: string }).id,
  }));

  const { error } = await adminDb
    .from("finals_participants")
    .insert(rows);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ added: toAdd.length });
}
