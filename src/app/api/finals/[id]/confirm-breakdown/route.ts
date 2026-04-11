import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: currentPlayer } = await supabase
    .from("players")
    .select("is_god_mode")
    .eq("user_id", user.id)
    .single();
  if (!(currentPlayer as unknown as { is_god_mode?: boolean } | null)?.is_god_mode) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const { data: event } = await supabase
    .from("finals_events")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (event.status !== "breakdown_generated") {
    return NextResponse.json(
      { error: "Generate the breakdown before confirming" },
      { status: 409 }
    );
  }

  // Validate: every group must have ≥4 players
  const { data: participants } = await supabase
    .from("finals_participants")
    .select("group_label")
    .eq("finals_event_id", id);

  const groupCounts: Record<string, number> = {};
  for (const p of participants ?? []) {
    if (p.group_label) groupCounts[p.group_label] = (groupCounts[p.group_label] ?? 0) + 1;
  }

  for (const [group, count] of Object.entries(groupCounts)) {
    if (count < 4) {
      return NextResponse.json(
        { error: `Group ${group} has only ${count} player(s) — minimum 4 required` },
        { status: 400 }
      );
    }
  }

  // Transition status so Sessions tab unlocks
  const { error } = await adminDb
    .from("finals_events")
    .update({ status: "sessions_created" })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
