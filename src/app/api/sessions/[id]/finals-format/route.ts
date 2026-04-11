import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";

// GET — fetch the current format for a finals session
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await supabase
    .from("players")
    .select("is_god_mode")
    .eq("user_id", user.id)
    .single();
  if (!(player as unknown as { is_god_mode?: boolean } | null)?.is_god_mode) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const { data, error } = await supabase
    .from("finals_formats")
    .select("*")
    .eq("session_id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ format: data });
}

// POST — set the format for a finals session
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await supabase
    .from("players")
    .select("is_god_mode")
    .eq("user_id", user.id)
    .single();
  if (!(player as unknown as { is_god_mode?: boolean } | null)?.is_god_mode) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Verify this is a finals session
  const { data: session } = await supabase
    .from("sessions")
    .select("id, session_type")
    .eq("id", id)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.session_type !== "finals") {
    return NextResponse.json({ error: "Not a finals session" }, { status: 400 });
  }

  const body = await req.json();
  const { format_type } = body;

  if (!format_type || !["playoffs", "fixed_partner"].includes(format_type)) {
    return NextResponse.json({ error: "Invalid format_type" }, { status: 400 });
  }

  // Check if format already exists — if so, only allow change if still in 'configured' status
  const { data: existing } = await supabase
    .from("finals_formats")
    .select("id, status")
    .eq("session_id", id)
    .maybeSingle();

  if (existing) {
    if (existing.status !== "configured") {
      return NextResponse.json(
        { error: "Cannot change format after matches have been generated" },
        { status: 409 }
      );
    }
    // Update existing
    const { data: updated, error } = await adminDb
      .from("finals_formats")
      .update({ format_type, config: {} })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ format: updated });
  }

  // Create new
  const { data: created, error } = await adminDb
    .from("finals_formats")
    .insert({ session_id: id, format_type })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ format: created }, { status: 201 });
}
