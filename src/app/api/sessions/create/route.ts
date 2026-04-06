import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await supabase
    .from("players").select("id, is_admin").eq("user_id", user.id).single();
  if (!player?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const today = now.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const dow = now.toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", weekday: "long" });
  const isTestSession = dow !== "Monday" && dow !== "Thursday";
  const nowIso = now.toISOString();

  // Enforce no-duplicate-active: if any session OTHER than today's is active, block it
  const { data: activeSession } = await adminDb
    .from("sessions")
    .select("id, date")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (activeSession && activeSession.date !== today) {
    return NextResponse.json({ error: "Another session is already active." }, { status: 400 });
  }

  // Check for an existing session for today
  const { data: existing } = await adminDb
    .from("sessions")
    .select("id, status")
    .eq("date", today)
    .maybeSingle();

  if (existing) {
    if (existing.status === "active") {
      return NextResponse.json({ id: existing.id });
    }
    // pending or completed → clear check-ins, reactivate
    await adminDb.from("session_players").delete().eq("session_id", existing.id);
    const { error } = await adminDb
      .from("sessions")
      .update({ status: "active", started_by: player.id, started_at: nowIso, is_test_session: isTestSession })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: existing.id });
  }

  // No session for today — create one linked to the most recent season
  const { data: season } = await adminDb
    .from("seasons")
    .select("id")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created, error } = await adminDb
    .from("sessions")
    .insert({
      date: today,
      status: "active",
      season_id: season?.id ?? null,
      started_by: player.id,
      started_at: nowIso,
      is_test_session: isTestSession,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: created.id });
}
