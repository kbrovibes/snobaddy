import { createClient } from "@/lib/supabase-server";

export interface PlayerStats {
  id: string;
  name: string;
  email: string;
  skill_level: number;
  is_admin: boolean;
  matches_played: number;
  wins: number;
  losses: number;
}

const ADMIN_EMAILS = ["karthik220290@gmail.com", "k4rthikr@gmail.com"];

export function isAdminEmail(email: string) {
  return ADMIN_EMAILS.includes(email);
}

export async function getAllPlayers(): Promise<PlayerStats[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .select("id, name, email, skill_level, is_admin")
    .eq("onboarding_complete", true)
    .order("name");

  if (error) throw new Error(error.message);

  // Stats will be 0 until matches table is populated (spec 03)
  return (data ?? []).map((p) => ({
    ...p,
    matches_played: 0,
    wins: 0,
    losses: 0,
  }));
}

export async function updateSkillLevel(playerId: string, skillLevel: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("players")
    .update({ skill_level: skillLevel })
    .eq("id", playerId);
  if (error) throw new Error(error.message);
}
