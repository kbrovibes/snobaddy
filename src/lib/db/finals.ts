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
