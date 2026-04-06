import { createClient } from "@/lib/supabase-server";
import { supabase as adminDb } from "@/lib/supabase";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;

  // Auth: god mode only
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await supabase
    .from("players")
    .select("is_god_mode")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!player?.is_god_mode) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get the stored photo path
  const { data: session } = await adminDb
    .from("sessions")
    .select("tally_photo_path")
    .eq("id", sessionId)
    .maybeSingle();

  const path = (session as unknown as { tally_photo_path?: string | null })?.tally_photo_path;
  if (!path) {
    return NextResponse.json({ error: "No photo on file" }, { status: 404 });
  }

  const { data, error } = await adminDb.storage
    .from("tally-photos")
    .createSignedUrl(path, 3600); // 1-hour expiry

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Could not generate signed URL" }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
