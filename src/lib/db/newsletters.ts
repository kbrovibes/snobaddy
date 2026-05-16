import { supabase as adminDb } from "@/lib/supabase";

export interface SeasonNewsletter {
  season_id: string;
  title: string | null;
  content_md: string;
  intro_context: string | null;
  stats_json: Record<string, unknown> | null;
  version: number;
  generated_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function getNewsletter(seasonId: string): Promise<SeasonNewsletter | null> {
  const { data, error } = await adminDb
    .from("season_newsletters")
    .select("season_id, title, content_md, intro_context, stats_json, version, generated_by, created_at, updated_at")
    .eq("season_id", seasonId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function upsertNewsletter(input: {
  season_id: string;
  title: string;
  content_md: string;
  intro_context: string | null;
  stats_json: Record<string, unknown> | null;
  generated_by: string | null;
}): Promise<SeasonNewsletter> {
  // Manual upsert: do an update first; if zero rows match, insert. This lets
  // us keep version monotonically increasing via the trigger on update.
  const { data: updated, error: updateError } = await adminDb
    .from("season_newsletters")
    .update({
      title: input.title,
      content_md: input.content_md,
      intro_context: input.intro_context,
      stats_json: input.stats_json,
      generated_by: input.generated_by,
    })
    .eq("season_id", input.season_id)
    .select()
    .maybeSingle();
  if (updateError) throw updateError;
  if (updated) return updated as SeasonNewsletter;

  const { data: inserted, error: insertError } = await adminDb
    .from("season_newsletters")
    .insert({
      season_id: input.season_id,
      title: input.title,
      content_md: input.content_md,
      intro_context: input.intro_context,
      stats_json: input.stats_json,
      generated_by: input.generated_by,
    })
    .select()
    .single();
  if (insertError) throw insertError;
  return inserted as SeasonNewsletter;
}
