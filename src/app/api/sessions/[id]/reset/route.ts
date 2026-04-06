import { createClient } from "@/lib/supabase-server";
import { supabase as serviceClient } from "@/lib/supabase";
import { NextResponse, type NextRequest } from "next/server";

async function godModeGuard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: player } = await supabase
    .from("players").select("is_god_mode").eq("user_id", user.id).single();
  if (!player?.is_god_mode) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { error: null };
}

// GET — pre-flight counts
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await godModeGuard();
  if (error) return error;

  const { id } = await params;

  const [{ count: matches }, { count: proposed }] = await Promise.all([
    serviceClient.from("matches").select("id", { count: "exact", head: true }).eq("session_id", id),
    serviceClient.from("proposed_matches").select("id", { count: "exact", head: true }).eq("session_id", id),
  ]);

  return NextResponse.json({ matches: matches ?? 0, proposed: proposed ?? 0 });
}

// POST — hard delete all matches + proposed matches for the session
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await godModeGuard();
  if (error) return error;

  const { id } = await params;

  const [{ count: deletedMatches }, { count: deletedProposed }] = await Promise.all([
    serviceClient.from("matches").delete({ count: "exact" }).eq("session_id", id),
    serviceClient.from("proposed_matches").delete({ count: "exact" }).eq("session_id", id),
  ]);

  return NextResponse.json({ deleted_matches: deletedMatches ?? 0, deleted_proposed: deletedProposed ?? 0 });
}
