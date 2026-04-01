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

  const { auto_generate_matches } = await request.json();

  const { error } = await supabase
    .from("sessions")
    .update({ auto_generate_matches })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
