import { createClient } from "@/lib/supabase-server";
import { updateSkillLevel, updatePlayerName } from "@/lib/db/players";
import { NextResponse, type NextRequest } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: currentPlayer } = await supabase
    .from("players")
    .select("is_admin, is_god_mode")
    .eq("user_id", user.id)
    .single();

  if (!currentPlayer?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { skill_level, name } = body as { skill_level?: number; name?: string };
  const { id } = await params;

  if (name !== undefined) {
    if (!currentPlayer.is_god_mode) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (!trimmed || trimmed.length > 50) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
    await updatePlayerName(id, trimmed);
  }

  if (skill_level !== undefined) {
    if (!skill_level || skill_level < 1 || skill_level > 5) {
      return NextResponse.json({ error: "Invalid skill_level" }, { status: 400 });
    }
    await updateSkillLevel(id, skill_level);
  }

  return NextResponse.json({ ok: true });
}
