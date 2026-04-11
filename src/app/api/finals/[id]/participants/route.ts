import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
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
  const body = await req.json();
  const { player_id } = body;

  if (!player_id || typeof player_id !== "string") {
    return NextResponse.json({ error: "player_id is required" }, { status: 400 });
  }

  // Verify the finals event exists and is in draft
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

  // Verify the player exists and is active
  const { data: targetPlayer } = await supabase
    .from("players")
    .select("id")
    .eq("id", player_id)
    .eq("onboarding_complete", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (!targetPlayer) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const { data: created, error } = await adminDb
    .from("finals_participants")
    .insert({
      finals_event_id: id,
      player_id,
      added_by: (player as unknown as { id: string }).id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Player already in Finals pool" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: created.id }, { status: 201 });
}
