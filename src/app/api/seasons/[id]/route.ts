import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
  const { name, start_date, end_date, stats_lock_date } = body as { name?: string; start_date?: string; end_date?: string; stats_lock_date?: string | null };

  const updates: Record<string, string | null> = {};
  if (name) updates.name = name;
  if (start_date) updates.start_date = start_date;
  if (end_date) updates.end_date = end_date;
  if ("stats_lock_date" in body) updates.stats_lock_date = stats_lock_date ?? null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  if (updates.start_date && updates.end_date && updates.end_date <= updates.start_date) {
    return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
  }

  const { error } = await adminDb
    .from("seasons")
    .update(updates)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
