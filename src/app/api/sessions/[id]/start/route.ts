import { createClient } from "@/lib/supabase-server";
import { notifyAdmins } from "@/lib/push";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await supabase
    .from("players").select("id, is_admin").eq("user_id", user.id).single();
  if (!player?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { error } = await supabase
    .from("sessions")
    .update({ status: "active", started_by: player.id, started_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify admin subscribers (fire-and-forget)
  const { data: sess } = await supabase
    .from("sessions").select("date").eq("id", id).maybeSingle();
  const dateLabel = sess?.date
    ? new Date(sess.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : "today";
  notifyAdmins({
    title: "Session Started",
    body: `Session for ${dateLabel} is now open for check-in`,
    url: `/session/${id}`,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
