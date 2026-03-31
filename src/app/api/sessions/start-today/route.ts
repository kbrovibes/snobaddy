import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await supabase
    .from("players").select("id, is_admin").eq("user_id", user.id).single();
  if (!player?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

  // Check if a session already exists for today
  const { data: existing } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("date", today)
    .maybeSingle();

  if (existing?.status === "active") {
    return NextResponse.json({ ok: true, already: true });
  }

  if (existing?.status === "completed") {
    return NextResponse.json({ error: "Today's session is already closed." }, { status: 400 });
  }

  const now = new Date().toISOString();

  if (existing) {
    // pending → active
    const { error } = await supabase
      .from("sessions")
      .update({ status: "active", started_by: player.id, started_at: now })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // No session yet — get the most recent season to link to
  const { data: season } = await supabase
    .from("seasons")
    .select("id")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
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
