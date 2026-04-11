import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await supabase
    .from("players")
    .select("id, is_admin")
    .eq("user_id", user.id)
    .single();
  if (!(player as unknown as { is_admin?: boolean } | null)?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get the most recent season
  const { data: season } = await adminDb
    .from("seasons")
    .select("id, name")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!season) {
    return NextResponse.json({ error: "No season found" }, { status: 400 });
  }

  // Check if a finals event already exists for this season
  const { data: existing } = await adminDb
    .from("finals_events")
    .select("id")
    .eq("season_id", season.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "A Finals Event already exists for this season", id: existing.id },
      { status: 409 }
    );
  }

  const { data: created, error } = await adminDb
    .from("finals_events")
    .insert({
      season_id: season.id,
      name: `${season.name} Finals`,
      status: "draft",
      created_by: (player as unknown as { id: string }).id,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: created.id }, { status: 201 });
}
