import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAllSeasons, createSeason } from "@/lib/db/seasons";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await supabase
    .from("players")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!player?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const seasons = await getAllSeasons();
  return NextResponse.json(seasons);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await supabase
    .from("players")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!player?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, start_date, end_date } = body;

  if (!name || !start_date || !end_date) {
    return NextResponse.json({ error: "Name, start_date, and end_date are required" }, { status: 400 });
  }

  try {
    const id = await createSeason({ name, start_date, end_date });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
