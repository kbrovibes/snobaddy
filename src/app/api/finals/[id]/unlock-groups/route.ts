import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";

// POST — revert a finals event back to breakdown_generated so groups can be edited
// Deletes generated sessions/formats/matches but keeps participants + group assignments
export async function POST(
  _req: NextRequest,
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

  const { id } = await params;

  const { data: event } = await supabase
    .from("finals_events")
    .select("id, status, finals1_session_id, finals2_session_id")
    .eq("id", id)
    .maybeSingle();

  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (event.status !== "sessions_created" && event.status !== "active") {
    return NextResponse.json(
      { error: "Can only edit groups when sessions are created or event is active" },
      { status: 409 }
    );
  }

  // Delete sessions, formats, and finals matches — but keep participants + groups
  const sessionIds = [event.finals1_session_id, event.finals2_session_id].filter(Boolean) as string[];
  if (sessionIds.length > 0) {
    await adminDb
      .from("finals_events")
      .update({ finals1_session_id: null, finals2_session_id: null })
      .eq("id", id);

    await adminDb
      .from("matches")
      .delete()
      .in("session_id", sessionIds)
      .in("match_type", ["finals_group", "finals_final"]);

    await adminDb
      .from("finals_formats")
      .delete()
      .in("session_id", sessionIds);

    await adminDb
      .from("sessions")
      .delete()
      .in("id", sessionIds);
  }

  // Revert status to breakdown_generated
  await adminDb
    .from("finals_events")
    .update({
      status: "breakdown_generated",
      finals1_session_id: null,
      finals2_session_id: null,
    })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
