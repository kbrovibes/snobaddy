import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST() {
  // Auth check via SSR client (reads cookies)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await supabase
    .from("players").select("id, is_admin").eq("user_id", user.id).single();
  if (!player?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Use Pacific date — must match the date used by getTodaySession
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

  // Use service-role client for all writes (bypasses RLS)
  const { data: existing } = await adminDb
    .from("sessions")
    .select("id, status")
    .eq("date", today)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existing) {
    // Clear all check-ins for a clean slate — this is a testing reset, not a real session start
    await adminDb.from("session_players").delete().eq("session_id", existing.id);

    const { error } = await adminDb
      .from("sessions")
      .update({ status: "active", started_by: player.id, started_at: now })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // No session yet — link to the most recent season
  const { data: season } = await adminDb
    .from("seasons")
    .select("id")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await adminDb
    .from("sessions")
    .insert({
      date: today,
      status: "active",
      season_id: season?.id ?? null,
      started_by: player.id,
      started_at: now,
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
