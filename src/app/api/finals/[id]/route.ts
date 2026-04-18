import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";

export async function GET(
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

  const { data, error } = await supabase
    .from("finals_events")
    .select("*, seasons(name), finals_participants(count)")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...data,
    season: data.seasons,
    participant_count:
      (data.finals_participants as unknown as { count: number }[])?.[0]?.count ?? 0,
  });
}

export async function DELETE(
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
    .select("id, finals1_session_id, finals2_session_id")
    .eq("id", id)
    .maybeSingle();

  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Break circular FKs: clear ALL session refs pointing at this event
  await adminDb.from("finals_events").update({ finals1_session_id: null, finals2_session_id: null }).eq("id", id);

  // Find all sessions linked to this finals event (not just the two stored on the event)
  const { data: linkedSessions } = await adminDb.from("sessions").select("id").eq("finals_event_id", id);
  const sessionIds = (linkedSessions ?? []).map((s: { id: string }) => s.id);

  if (sessionIds.length > 0) {
    await adminDb.from("sessions").update({ finals_event_id: null }).in("id", sessionIds);
    await adminDb.from("matches").delete().in("session_id", sessionIds).in("match_type", ["finals_group", "finals_final"]);
    await adminDb.from("finals_formats").delete().in("session_id", sessionIds);
    await adminDb.from("session_players").delete().in("session_id", sessionIds);
    await adminDb.from("sessions").delete().in("id", sessionIds);
  }
  await adminDb.from("finals_participants").delete().eq("finals_event_id", id);

  const { error } = await adminDb
    .from("finals_events")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
