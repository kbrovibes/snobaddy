import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";

// POST — reset a group's format (delete format, matches, series)
export async function POST(
  req: NextRequest,
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
  if (!(player as unknown as { is_admin?: boolean } | null)?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: sessionId } = await params;
  const body = await req.json();
  const { finals_group } = body as { finals_group: string };

  if (!finals_group || !["A", "B", "C"].includes(finals_group)) {
    return NextResponse.json({ error: "finals_group must be A or B" }, { status: 400 });
  }

  // Delete series for this group
  const { data: series } = await supabase
    .from("finals_series")
    .select("id")
    .eq("session_id", sessionId)
    .eq("finals_group", finals_group);

  if (series && series.length > 0) {
    const seriesIds = series.map((s) => s.id);
    // Delete series matches
    await adminDb.from("matches").delete().in("series_id", seriesIds);
    // Delete series
    await adminDb.from("finals_series").delete().in("id", seriesIds);
  }

  // Delete group-stage matches for this group
  await adminDb
    .from("matches")
    .delete()
    .eq("session_id", sessionId)
    .eq("finals_group", finals_group);

  // Delete the format row
  await adminDb
    .from("finals_formats")
    .delete()
    .eq("session_id", sessionId)
    .eq("finals_group", finals_group);

  return NextResponse.json({ ok: true });
}
