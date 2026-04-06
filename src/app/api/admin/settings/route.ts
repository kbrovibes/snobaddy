import { createClient } from "@/lib/supabase-server";
import { setAppSetting } from "@/lib/db/settings";
import { NextResponse, type NextRequest } from "next/server";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: player } = await supabase
    .from("players")
    .select("is_god_mode")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!player?.is_god_mode) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { key, value } = body as { key: string; value: string };
  if (!key || !value) return NextResponse.json({ error: "key and value required" }, { status: 400 });

  await setAppSetting(key, value);
  return NextResponse.json({ ok: true });
}
