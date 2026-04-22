import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await authClient.from("players").select("is_admin").eq("user_id", user.id).maybeSingle();
  if (!player?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { whiteboard_mode } = await request.json();

  // Prevent turning off if tally data exists
  if (whiteboard_mode === false) {
    const { count } = await authClient
      .from("session_tally")
      .select("*", { count: "exact", head: true })
      .eq("session_id", id);
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "Cannot disable whiteboard mode: tally data already exists" },
        { status: 409 }
      );
    }
  }

  const { error } = await supabase
    .from("sessions")
    .update({ whiteboard_mode })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
