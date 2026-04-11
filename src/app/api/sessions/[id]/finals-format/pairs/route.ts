import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";

// POST — save pair assignments to finals_formats.config
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await supabase
    .from("players")
    .select("is_god_mode")
    .eq("user_id", user.id)
    .single();
  if (!(player as unknown as { is_god_mode?: boolean } | null)?.is_god_mode) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: sessionId } = await params;

  // Verify session is a finals session
  const { data: session } = await supabase
    .from("sessions")
    .select("id, session_type, finals_event_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.session_type !== "finals") {
    return NextResponse.json({ error: "Not a finals session" }, { status: 400 });
  }

  // Verify format exists and is still configurable
  const { data: format } = await supabase
    .from("finals_formats")
    .select("id, format_type, status")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!format) {
    return NextResponse.json({ error: "No format selected yet" }, { status: 400 });
  }
  if (format.format_type !== "fixed_partner") {
    return NextResponse.json({ error: "Pairs only apply to Fixed-Partner format" }, { status: 400 });
  }
  if (format.status !== "configured") {
    return NextResponse.json({ error: "Cannot change pairs after matches have been generated" }, { status: 409 });
  }

  const body = await req.json();
  const { pairs } = body as {
    pairs: Record<string, { player1_id: string; player2_id: string }[]>;
  };

  if (!pairs || typeof pairs !== "object") {
    return NextResponse.json({ error: "Missing pairs data" }, { status: 400 });
  }

  // Validate: fetch participants for this finals event to confirm player IDs and groups
  const { data: participants } = await supabase
    .from("finals_participants")
    .select("player_id, group_label")
    .eq("finals_event_id", session.finals_event_id);

  if (!participants) {
    return NextResponse.json({ error: "Could not fetch participants" }, { status: 500 });
  }

  const playerGroups = new Map(
    (participants as { player_id: string; group_label: string }[]).map((p) => [p.player_id, p.group_label])
  );

  // Validate each group's pairs
  for (const [groupLabel, groupPairs] of Object.entries(pairs)) {
    const groupPlayers = participants.filter(
      (p: { group_label: string }) => p.group_label === groupLabel
    );
    if (groupPlayers.length === 0) {
      return NextResponse.json({ error: `No players in group ${groupLabel}` }, { status: 400 });
    }
    if (groupPlayers.length % 2 !== 0) {
      return NextResponse.json(
        { error: `Group ${groupLabel} has odd number of players (${groupPlayers.length})` },
        { status: 400 }
      );
    }

    const assignedIds = new Set<string>();
    for (const pair of groupPairs) {
      if (!pair.player1_id || !pair.player2_id) {
        return NextResponse.json({ error: "All pair slots must be filled" }, { status: 400 });
      }
      if (pair.player1_id === pair.player2_id) {
        return NextResponse.json({ error: "A player cannot be paired with themselves" }, { status: 400 });
      }
      // Verify both players belong to this group
      if (playerGroups.get(pair.player1_id) !== groupLabel) {
        return NextResponse.json({ error: `Player ${pair.player1_id} is not in group ${groupLabel}` }, { status: 400 });
      }
      if (playerGroups.get(pair.player2_id) !== groupLabel) {
        return NextResponse.json({ error: `Player ${pair.player2_id} is not in group ${groupLabel}` }, { status: 400 });
      }
      if (assignedIds.has(pair.player1_id) || assignedIds.has(pair.player2_id)) {
        return NextResponse.json({ error: "Duplicate player assignment detected" }, { status: 400 });
      }
      assignedIds.add(pair.player1_id);
      assignedIds.add(pair.player2_id);
    }

    // All group players must be assigned
    if (assignedIds.size !== groupPlayers.length) {
      return NextResponse.json(
        { error: `Not all players in group ${groupLabel} are assigned to pairs` },
        { status: 400 }
      );
    }
  }

  // Save pairs into finals_formats.config
  const { data: updated, error } = await adminDb
    .from("finals_formats")
    .update({ config: { pairs } })
    .eq("id", format.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ format: updated });
}
