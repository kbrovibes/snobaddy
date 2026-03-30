import { createClient } from "@/lib/supabase-server";
import { updateSkillLevel } from "@/lib/db/players";
import { NextResponse, type NextRequest } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await supabase
    .from("players")
    .select("is_admin")
    .eq("user_id", user.id)
    .single();

  if (!player?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { skill_level } = await request.json();
  if (!skill_level || skill_level < 1 || skill_level > 5) {
    return NextResponse.json({ error: "Invalid skill_level" }, { status: 400 });
  }

  const { id } = await params;
  await updateSkillLevel(id, skill_level);
  return NextResponse.json({ ok: true });
}
