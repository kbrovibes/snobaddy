import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";

// POST — save pair assignments for a specific group's format
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await supabase
    .from("players")
    .select("is_admin")
    .eq("user_id", user.id)
    .single();
  if (!(player as unknown as { is_admin?: boolean } | null)?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: sessionId } = await params;

  const { data: session } = await supabase
    .from("sessions")
    .select("id, session_type, finals_event_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.session_type !== "finals") {
    return NextResponse.json({ error: "Not a finals session" }, { status: 400 });
  }

  const body = await req.json();
  const { finals_group, pairs } = body as {
    finals_group: string;
    pairs: { player1_id: string; player2_id: string }[];
  };

  if (!finals_group || !["A", "B", "C"].includes(finals_group)) {
    return NextResponse.json({ error: "finals_group must be A or B" }, { status: 400 });
  }
  if (!pairs || !Array.isArray(pairs)) {
    return NextResponse.json({ error: "Missing pairs data" }, { status: 400 });
  }

  // Verify format exists for this group and is configurable
  const { data: format } = await supabase
    .from("finals_formats")
    .select("id, format_type, status")
    .eq("session_id", sessionId)
    .eq("finals_group", finals_group)
    .maybeSingle();

  if (!format) {
    return NextResponse.json({ error: `No format selected for Group ${finals_group}` }, { status: 400 });
  }
  if (format.format_type !== "fixed_partner") {
    return NextResponse.json({ error: "Pairs only apply to Fixed-Partner format" }, { status: 400 });
  }
  if (format.status !== "configured") {
    return NextResponse.json({ error: "Cannot change pairs after matches have been generated" }, { status: 409 });
  }

  // Validate player IDs belong to this group
  const { data: participants } = await supabase
    .from("finals_participants")
    .select("player_id, group_label")
    .eq("finals_event_id", session.finals_event_id);

  if (!participants) {
    return NextResponse.json({ error: "Could not fetch participants" }, { status: 500 });
  }

  const groupPlayers = (participants as { player_id: string; group_label: string }[])
    .filter((p) => p.group_label === finals_group);

  if (groupPlayers.length === 0) {
    return NextResponse.json({ error: `No players in group ${finals_group}` }, { status: 400 });
  }
  if (groupPlayers.length % 2 !== 0) {
    return NextResponse.json(
      { error: `Group ${finals_group} has odd number of players (${groupPlayers.length})` },
      { status: 400 }
    );
  }

  const groupPlayerIds = new Set(groupPlayers.map((p) => p.player_id));
  const assignedIds = new Set<string>();

  for (const pair of pairs) {
    if (!pair.player1_id || !pair.player2_id) {
      return NextResponse.json({ error: "All pair slots must be filled" }, { status: 400 });
    }
    if (pair.player1_id === pair.player2_id) {
      return NextResponse.json({ error: "A player cannot be paired with themselves" }, { status: 400 });
    }
    if (!groupPlayerIds.has(pair.player1_id) || !groupPlayerIds.has(pair.player2_id)) {
      return NextResponse.json({ error: "Player not in this group" }, { status: 400 });
    }
    if (assignedIds.has(pair.player1_id) || assignedIds.has(pair.player2_id)) {
      return NextResponse.json({ error: "Duplicate player assignment" }, { status: 400 });
    }
    assignedIds.add(pair.player1_id);
    assignedIds.add(pair.player2_id);
  }

  if (assignedIds.size !== groupPlayers.length) {
    return NextResponse.json({ error: "Not all players assigned to pairs" }, { status: 400 });
  }

  // Save pairs into format config
  const { data: updated, error } = await adminDb
    .from("finals_formats")
    .update({ config: { pairs } })
    .eq("id", format.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ format: updated });
}
