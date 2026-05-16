import { NextResponse } from "next/server";
import { getAuthPlayer } from "@/lib/auth";
import { getSeasonStats } from "@/lib/newsletter/stats";
import { generateNewsletter } from "@/lib/newsletter/generate";
import { upsertNewsletter } from "@/lib/db/newsletters";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await getAuthPlayer();
  if (!auth?.isAdmin) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { id: seasonId } = await params;
  let body: { extraContext?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine — regenerate with no extra context
  }
  const extraContext = (body.extraContext ?? "").trim() || null;

  const stats = await getSeasonStats(seasonId);
  const { title, content_md } = generateNewsletter(stats, { extraContext });

  const saved = await upsertNewsletter({
    season_id: seasonId,
    title,
    content_md,
    intro_context: extraContext,
    stats_json: stats as unknown as Record<string, unknown>,
    generated_by: auth.id,
  });

  return NextResponse.json({
    ok: true,
    season_id: saved.season_id,
    version: saved.version,
    updated_at: saved.updated_at,
  });
}
