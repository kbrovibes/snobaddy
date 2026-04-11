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

  const { data: currentPlayer } = await supabase
    .from("players")
    .select("is_admin")
    .eq("user_id", user.id)
    .single();
  if (!(currentPlayer as unknown as { is_admin?: boolean } | null)?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { day1_date, day2_date } = body as { day1_date?: string; day2_date?: string };

  if (!day1_date || !day2_date) {
    return NextResponse.json({ error: "day1_date and day2_date are required (YYYY-MM-DD)" }, { status: 400 });
  }
  // Basic date format validation
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day1_date) || !/^\d{4}-\d{2}-\d{2}$/.test(day2_date)) {
    return NextResponse.json({ error: "Dates must be YYYY-MM-DD" }, { status: 400 });
  }

  const { data: event } = await adminDb
    .from("finals_events")
    .select("status, season_id, finals1_session_id")
    .eq("id", id)
    .maybeSingle();

  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (event.status !== "breakdown_generated" && event.status !== "sessions_created") {
    return NextResponse.json(
      { error: "Confirm the group breakdown before generating sessions" },
      { status: 409 }
    );
  }

  // Idempotent: if sessions already exist, return them
  if (event.finals1_session_id) {
    return NextResponse.json({ error: "Sessions already generated" }, { status: 409 });
  }

  // Create Day 1 session (Groups A & B)
  const { data: session1, error: err1 } = await adminDb
    .from("sessions")
    .insert({
      date: day1_date,
      status: "pending",
      season_id: event.season_id,
      session_type: "finals",
      finals_event_id: id,
      is_test_session: false,
    })
    .select("id")
    .single();

  if (err1 || !session1) {
    return NextResponse.json({ error: err1?.message ?? "Failed to create Day 1 session" }, { status: 500 });
  }

  // Create Day 2 session (Group C)
  const { data: session2, error: err2 } = await adminDb
    .from("sessions")
    .insert({
      date: day2_date,
      status: "pending",
      season_id: event.season_id,
      session_type: "finals",
      finals_event_id: id,
      is_test_session: false,
    })
    .select("id")
    .single();

  if (err2 || !session2) {
    // Roll back session1
    await adminDb.from("sessions").delete().eq("id", session1.id);
    return NextResponse.json({ error: err2?.message ?? "Failed to create Day 2 session" }, { status: 500 });
  }

  // Link sessions back to the finals event + advance status
  const { error: updateErr } = await adminDb
    .from("finals_events")
    .update({
      finals1_session_id: session1.id,
      finals2_session_id: session2.id,
      status: "sessions_created",
    })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    finals1_session_id: session1.id,
    finals2_session_id: session2.id,
  });
}
