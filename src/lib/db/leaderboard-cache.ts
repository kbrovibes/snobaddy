import { createClient } from "@/lib/supabase-server";
import { supabase as serviceClient } from "@/lib/supabase";
import { createHash } from "crypto";

/**
 * Compute a content-based signature for leaderboard data.
 * Changes when: match added/deleted, tally uploaded, player added/deleted, lock date changed.
 * Uses only counts and max timestamps — no row scanning (~5ms).
 */
export async function computeLeaderboardSignature(
  seasonId: string,
  seasonLockDate: string | null
): Promise<string> {
  const supabase = await createClient();

  const [matchStats, tallyStats, playerCount] = await Promise.all([
    supabase
      .from("matches")
      .select("id, created_at, sessions!inner(season_id)")
      .eq("sessions.season_id", seasonId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(async ({ data: latest }) => {
        const { count } = await supabase
          .from("matches")
          .select("id, sessions!inner(season_id)", { count: "exact", head: true })
          .eq("sessions.season_id", seasonId);
        return { count: count ?? 0, latest_at: latest?.created_at ?? "" };
      }),
    supabase
      .from("session_tally")
      .select("id, created_at, sessions!inner(season_id)")
      .eq("sessions.season_id", seasonId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(async ({ data: latest }) => {
        const { count } = await supabase
          .from("session_tally")
          .select("id, sessions!inner(season_id)", { count: "exact", head: true })
          .eq("sessions.season_id", seasonId);
        return { count: count ?? 0, latest_at: latest?.created_at ?? "" };
      }),
    supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("onboarding_complete", true)
      .is("deleted_at", null)
      .then(({ count }) => count ?? 0),
  ]);

  const raw = [
    seasonId,
    matchStats.count,
    matchStats.latest_at,
    tallyStats.count,
    tallyStats.latest_at,
    playerCount,
    seasonLockDate ?? "",
  ].join("|");

  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

/**
 * Get leaderboard data from cache if signature matches, otherwise return null.
 */
export async function getCachedLeaderboard(
  seasonId: string,
  signature: string
): Promise<unknown | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leaderboard_cache")
    .select("signature, data")
    .eq("season_id", seasonId)
    .maybeSingle();

  if (data?.signature === signature) {
    return data.data;
  }
  return null;
}

/**
 * Store computed leaderboard data in cache (upsert by season_id).
 */
export async function setCachedLeaderboard(
  seasonId: string,
  signature: string,
  data: unknown
): Promise<void> {
  await serviceClient
    .from("leaderboard_cache")
    .upsert(
      {
        season_id: seasonId,
        signature,
        computed_at: new Date().toISOString(),
        data: data as Record<string, unknown>,
      },
      { onConflict: "season_id" }
    );
}

/**
 * Invalidate (delete) cached leaderboard for a season.
 */
export async function invalidateLeaderboardCache(seasonId: string): Promise<void> {
  await serviceClient
    .from("leaderboard_cache")
    .delete()
    .eq("season_id", seasonId);
}
