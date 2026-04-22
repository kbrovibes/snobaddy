import { createClient } from "@/lib/supabase-server";
import { incrementTally } from "@/lib/db/tally";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { player_id, field, delta } = body;

  // Validate input
  if (!player_id || !["wins", "losses"].includes(field) || ![1, -1].includes(delta)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Fetch session — must be active with whiteboard_mode
  const { data: session } = await supabase
    .from("sessions")
    .select("status, whiteboard_mode")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.status !== "active") {
    return NextResponse.json({ error: "Session is not active" }, { status: 400 });
  }
  if (!session.whiteboard_mode) {
    return NextResponse.json({ error: "Whiteboard mode is not enabled" }, { status: 400 });
  }

  // Verify player is a session participant
  const { data: sp } = await supabase
    .from("session_players")
    .select("player_id")
    .eq("session_id", sessionId)
    .eq("player_id", player_id)
    .maybeSingle();

  if (!sp) {
    return NextResponse.json({ error: "Player is not in this session" }, { status: 400 });
  }

  const result = await incrementTally(sessionId, player_id, field, delta);
  return NextResponse.json({ ok: true, ...result });
}
