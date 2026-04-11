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
  added_at: string;
}

export async function getFinalsParticipants(
  finalsEventId: string
): Promise<FinalsParticipant[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("finals_participants")
    .select("id, player_id, group_label, added_at, players(name, skill_level)")
    .eq("finals_event_id", finalsEventId)
    .order("added_at", { ascending: true });

  if (!data) return [];
  return data.map((row) => {
    const p = row.players as unknown as { name: string; skill_level: number };
    return {
      id: row.id,
      player_id: row.player_id,
      name: p?.name ?? "Unknown",
      skill_level: p?.skill_level ?? 3,
      group_label: row.group_label,
      added_at: row.added_at,
    };
  });
}
