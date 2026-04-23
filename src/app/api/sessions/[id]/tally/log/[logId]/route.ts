import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";
import { incrementTally } from "@/lib/db/tally";

/** DELETE — undo a whiteboard log entry (reverses the tally change and deletes the log row) */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> }
) {
  const { id: sessionId, logId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch the log entry
  const { data: entry } = await adminDb
    .from("whiteboard_log")
    .select("session_id, player_id, field, delta")
    .eq("id", logId)
    .maybeSingle();

  if (!entry) return NextResponse.json({ error: "Log entry not found" }, { status: 404 });
  if (entry.session_id !== sessionId) return NextResponse.json({ error: "Mismatch" }, { status: 400 });

  // Reverse the tally change
  const reverseDelta = (entry.delta === 1 ? -1 : 1) as 1 | -1;
  await incrementTally(sessionId, entry.player_id, entry.field as "wins" | "losses", reverseDelta);

  // Delete the log entry
  await adminDb.from("whiteboard_log").delete().eq("id", logId);

  return NextResponse.json({ ok: true });
}
