import { createClient } from "@/lib/supabase-server";
import { notifyAdmins } from "@/lib/push";
import { processSessionUbr } from "@/lib/db/ubr";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await supabase
    .from("players").select("is_admin").eq("user_id", user.id).single();
  if (!player?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // Auto-checkout all players still present
  await supabase
    .from("session_players")
    .update({ checked_out_at: new Date().toISOString() })
    .eq("session_id", id)
    .is("checked_out_at", null);

  const { error } = await supabase
    .from("sessions")
    .update({ status: "completed" })
    .eq("id", id)
    .in("status", ["active", "pending"]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-finalize finals event if both sessions are now completed
  const { data: session } = await supabase
    .from("sessions")
    .select("finals_event_id")
    .eq("id", id)
    .maybeSingle();

  if (session?.finals_event_id) {
    const { data: event } = await supabase
      .from("finals_events")
      .select("finals1_session_id, finals2_session_id")
      .eq("id", session.finals_event_id)
      .maybeSingle();

    if (event) {
      const siblingIds = [event.finals1_session_id, event.finals2_session_id].filter(Boolean) as string[];
      const { data: siblings } = await supabase
        .from("sessions")
        .select("status")
        .in("id", siblingIds);

      const allCompleted = siblings?.length === siblingIds.length &&
        siblings.every((s) => s.status === "completed");

      if (allCompleted) {
        await supabase
          .from("finals_events")
          .update({ status: "completed" })
          .eq("id", session.finals_event_id);
      }
    }
  }

  // Notify admin subscribers (fire-and-forget)
  const { data: closedSess } = await supabase
    .from("sessions").select("date").eq("id", id).maybeSingle();
  const closeDateLabel = closedSess?.date
    ? new Date(closedSess.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : "today";
  notifyAdmins({
    title: "Session Closed",
    body: `Session for ${closeDateLabel} has been closed`,
    url: `/session/${id}`,
  }).catch(() => {});

  // Recalculate UBR ratings (fire-and-forget, non-test sessions only)
  const { data: sessCheck } = await supabase
    .from("sessions")
    .select("is_test_session")
    .eq("id", id)
    .maybeSingle();
  if (sessCheck && !sessCheck.is_test_session) {
    processSessionUbr(id).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
