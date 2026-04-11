import { createClient } from "@/lib/supabase-server";

export interface FinalsEvent {
  id: string;
  season_id: string;
  name: string;
  status: "draft" | "breakdown_generated" | "sessions_created" | "active" | "completed";
  finals1_session_id: string | null;
  finals2_session_id: string | null;
  created_at: string;
  season: { name: string } | null;
  participant_count: number;
}

export async function getActiveFinals(): Promise<FinalsEvent | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("finals_events")
    .select("*, seasons(name), finals_participants(count)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    ...data,
    season: (data.seasons as unknown as { name: string } | null),
    participant_count:
      (data.finals_participants as unknown as { count: number }[])?.[0]?.count ?? 0,
  };
}

export async function getFinalsById(id: string): Promise<FinalsEvent | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("finals_events")
    .select("*, seasons(name), finals_participants(count)")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;
  return {
    ...data,
    season: (data.seasons as unknown as { name: string } | null),
    participant_count:
      (data.finals_participants as unknown as { count: number }[])?.[0]?.count ?? 0,
  };
}

export interface FinalsParticipant {
  id: string;
  player_id: string;
  name: string;
  skill_level: number;
  group_label: string | null;
  finals_day: number | null;
  group_override: boolean;
  added_at: string;
  // Score snapshot (set after generate-breakdown)
  finals_score: number | null;
  season_win_rate: number | null;
  season_wins: number | null;
  season_losses: number | null;
  score_explanation: string | null;
}

export async function getFinalsParticipants(
  finalsEventId: string
): Promise<FinalsParticipant[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("finals_participants")
    .select(
      "id, player_id, group_label, finals_day, group_override, added_at, " +
      "finals_score, season_win_rate, season_wins, season_losses, score_explanation, " +
      "players(name, skill_level)"
    )
    .eq("finals_event_id", finalsEventId)
    .order("finals_score", { ascending: false, nullsFirst: false });

  if (!data) return [];
  return data.map((row) => {
    const p = row.players as unknown as { name: string; skill_level: number };
    return {
      id: row.id,
      player_id: row.player_id,
      name: p?.name ?? "Unknown",
      skill_level: p?.skill_level ?? 3,
      group_label: row.group_label,
      finals_day: row.finals_day,
      group_override: row.group_override ?? false,
      added_at: row.added_at,
      finals_score: row.finals_score,
      season_win_rate: row.season_win_rate,
      season_wins: row.season_wins,
      season_losses: row.season_losses,
      score_explanation: row.score_explanation,
    };
  });
}
