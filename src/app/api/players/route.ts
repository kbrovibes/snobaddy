import { getActivePlayers } from "@/lib/db/players";
import { createClient } from "@/lib/supabase-server";
import { supabase as serviceClient } from "@/lib/supabase";
import { NextResponse, type NextRequest } from "next/server";

export async function GET() {
  const players = await getActivePlayers();
  return NextResponse.json(players);
}

export async function POST(request: NextRequest) {
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

  const body = await request.json();
  const { name, skill_level } = body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (
    !skill_level ||
    !Number.isInteger(skill_level) ||
    skill_level < 1 ||
    skill_level > 5
  ) {
    return NextResponse.json({ error: "skill_level must be 1–5" }, { status: 400 });
  }

  const { data: newPlayer, error } = await serviceClient
    .from("players")
    .insert({
      name: name.trim(),
      skill_level,
      user_id: null,
      email: null,
      is_admin: false,
      onboarding_complete: true,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: newPlayer.id }, { status: 201 });
}
