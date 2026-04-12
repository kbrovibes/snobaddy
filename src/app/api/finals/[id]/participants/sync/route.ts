import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";

/**
 * PUT /api/finals/[id]/participants/sync
 * Replaces the entire participant list with the provided player_ids.
 * Body: { player_ids: string[] }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await supabase
    .from("players")
    .select("id, is_admin")
    .eq("user_id", user.id)
    .single();
  if (!(player as unknown as { is_admin?: boolean } | null)?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { player_ids } = body;

  if (!Array.isArray(player_ids)) {
    return NextResponse.json({ error: "player_ids must be an array" }, { status: 400 });
  }

  // Verify event exists and is editable
  const { data: event } = await supabase
    .from("finals_events")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (event.status !== "draft" && event.status !== "breakdown_generated") {
    return NextResponse.json(
      { error: "Cannot modify players after groups have been confirmed" },
      { status: 409 }
    );
  }

  const adminId = (player as unknown as { id: string }).id;

  // Delete all existing participants
  const { error: delError } = await adminDb
    .from("finals_participants")
    .delete()
    .eq("finals_event_id", id);

  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

  // Insert new list (if any)
  if (player_ids.length > 0) {
    const rows = player_ids.map((pid: string) => ({
      finals_event_id: id,
      player_id: pid,
      added_by: adminId,
    }));

    const { error: insError } = await adminDb
      .from("finals_participants")
      .insert(rows);

    if (insError) return NextResponse.json({ error: insError.message }, { status: 500 });
  }

  return NextResponse.json({ count: player_ids.length });
}
