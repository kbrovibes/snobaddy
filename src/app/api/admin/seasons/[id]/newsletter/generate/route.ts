import { NextResponse } from "next/server";
import { getAuthPlayer } from "@/lib/auth";
import { supabase as adminDb } from "@/lib/supabase";
import { getSeasonStats } from "@/lib/newsletter/stats";
import { generateNewsletter } from "@/lib/newsletter/generate";
import { getNewsletter, upsertNewsletter } from "@/lib/db/newsletters";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/seasons/[id]/newsletter/generate
 *
 * Generates and persists the season newsletter. Admin only. Allowed only when:
 *   - season has a stats_lock_date set
 *   - that lock date is today or in the past
 *   - no newsletter row exists yet for this season
 *
 * Regeneration after the first generate is done via the CLI seed script —
 * this endpoint is intentionally one-shot.
 */
export async function POST(_req: Request, { params }: Params) {
  const auth = await getAuthPlayer();
  if (!auth?.isAdmin) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const { id: seasonId } = await params;

  const { data: season, error: seasonErr } = await adminDb
    .from("seasons")
    .select("id, name, stats_lock_date")
    .eq("id", seasonId)
    .maybeSingle();
  if (seasonErr || !season) {
    return NextResponse.json({ error: "Season not found" }, { status: 404 });
  }
  if (!season.stats_lock_date) {
    return NextResponse.json({ error: "Season has no stats lock date set" }, { status: 400 });
  }

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  if (season.stats_lock_date > today) {
    return NextResponse.json({ error: `Lock date is in the future (${season.stats_lock_date})` }, { status: 400 });
  }

  const existing = await getNewsletter(seasonId);
  if (existing) {
    return NextResponse.json({ error: "Newsletter already exists for this season" }, { status: 409 });
  }

  const stats = await getSeasonStats(seasonId);
  const { title, content_md } = generateNewsletter(stats);
  const saved = await upsertNewsletter({
    season_id: seasonId,
    title,
    content_md,
    intro_context: null,
    stats_json: stats as unknown as Record<string, unknown>,
    generated_by: auth.id,
  });

  return NextResponse.json({
    ok: true,
    season_id: saved.season_id,
    updated_at: saved.updated_at,
  });
}
