import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";

// POST — reset a finals event back to draft (clears breakdown, sessions, matches)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await supabase
    .from("players")
    .select("is_god_mode")
    .eq("user_id", user.id)
    .single();
  if (!(player as unknown as { is_god_mode?: boolean } | null)?.is_god_mode) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const { data: event } = await supabase
    .from("finals_events")
    .select("id, status, finals1_session_id, finals2_session_id")
    .eq("id", id)
    .maybeSingle();

  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Break circular FK: clear session refs first, then delete
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

  // Clear breakdown data on participants (keep them in the pool)
  await adminDb
    .from("finals_participants")
    .update({
      group_label: null,
      finals_day: null,
      finals_score: null,
      season_win_rate: null,
      season_wins: null,
      season_losses: null,
      score_breakdown: null,
      score_explanation: null,
      group_override: false,
    })
    .eq("finals_event_id", id);

  // Reset event to draft
  await adminDb
    .from("finals_events")
    .update({
      status: "draft",
      finals1_session_id: null,
      finals2_session_id: null,
    })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
