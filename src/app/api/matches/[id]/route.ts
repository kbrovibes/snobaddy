import { createClient } from "@/lib/supabase-server";
import { NextResponse, type NextRequest } from "next/server";

async function requireAdminOnActiveSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  matchId: string
) {
  const { data: player } = await supabase
    .from("players")
    .select("is_admin")
    .eq("user_id", userId)
    .single();

  if (!player?.is_admin) return { err: "Forbidden", status: 403 as const };

  const { data: match } = await supabase
    .from("matches")
    .select("id, sessions(status)")
    .eq("id", matchId)
    .single();

  if (!match) return { err: "Not found", status: 404 as const };

  const sessionStatus = (match.sessions as unknown as { status: string }).status;
  if (sessionStatus !== "active") return { err: "Session is not active", status: 409 as const };

  return { ok: true as const };
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const check = await requireAdminOnActiveSession(supabase, user.id, id);
  if ("err" in check) return NextResponse.json({ error: check.err }, { status: check.status });

  const { error } = await supabase.from("matches").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const check = await requireAdminOnActiveSession(supabase, user.id, id);
  if ("err" in check) return NextResponse.json({ error: check.err }, { status: check.status });

  const { team1_score, team2_score } = await request.json();

  if (typeof team1_score !== "number" || typeof team2_score !== "number" || team1_score < 0 || team2_score < 0) {
    return NextResponse.json({ error: "Invalid scores" }, { status: 400 });
  }
  if (team1_score === team2_score) {
    return NextResponse.json({ error: "Scores cannot be tied" }, { status: 400 });
  }

  const winning_team = team1_score > team2_score ? 1 : 2;

  const { error } = await supabase
    .from("matches")
    .update({ team1_score, team2_score, winning_team })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
