import { createClient } from "@/lib/supabase-server";
import { supabase as serviceClient } from "@/lib/supabase";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  await serviceClient
    .from("players")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("user_id", user.id);

  return Response.json({ ok: true });
}
