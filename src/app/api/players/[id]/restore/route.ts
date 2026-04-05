import { createClient } from "@/lib/supabase-server";
import { supabase as serviceClient } from "@/lib/supabase";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: currentPlayer } = await supabase
    .from("players")
    .select("is_admin")
    .eq("user_id", user.id)
    .single();

  if (!currentPlayer?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const { data: target } = await serviceClient
    .from("players")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await serviceClient
    .from("players")
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
