import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getPlayerById, getPlayerPoemContext, upsertPlayerPoem } from "@/lib/db/players";
import { generatePlayerPoem } from "@/lib/ai/poem";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: currentPlayer } = await supabase
    .from("players")
    .select("is_god_mode")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!currentPlayer?.is_god_mode) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const player = await getPlayerById(id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const poemContext = await getPlayerPoemContext(id);
  const poem = await generatePlayerPoem(player.name, poemContext);
  const totalMatches = poemContext.wins + poemContext.losses;
  await upsertPlayerPoem(id, poem, totalMatches);

  return NextResponse.json({ poem });
}
