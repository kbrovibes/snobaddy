import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; playerId: string }> }
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

  const { id, playerId } = await params;
  const body = await req.json();
  const { group_label } = body;

  if (!["A", "B", "C"].includes(group_label)) {
    return NextResponse.json({ error: "group_label must be A, B, or C" }, { status: 400 });
  }

  // Only allow in breakdown_generated state
  const { data: event } = await supabase
    .from("finals_events")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (event.status !== "breakdown_generated") {
    return NextResponse.json(
      { error: "Generate the breakdown before overriding groups" },
      { status: 409 }
    );
  }

  const { error } = await adminDb
    .from("finals_participants")
    .update({
      group_label,
      finals_day: group_label === "C" ? 2 : 1,
      group_override: true,
    })
    .eq("finals_event_id", id)
    .eq("player_id", playerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
