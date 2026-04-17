import { createClient } from "@/lib/supabase-server";
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
  const { error } = await supabase
    .from("sessions")
    .update({ status: "active" })
    .eq("id", id)
    .eq("status", "completed");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Un-finalize finals event if it was completed
  const { data: session } = await supabase
    .from("sessions")
    .select("finals_event_id")
    .eq("id", id)
    .maybeSingle();

  if (session?.finals_event_id) {
    await supabase
      .from("finals_events")
      .update({ status: "active" })
      .eq("id", session.finals_event_id)
      .eq("status", "completed");
  }

  return NextResponse.json({ ok: true });
}
