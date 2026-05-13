import { cache } from "react";
import { createClient } from "@/lib/supabase-server";

export interface AuthPlayer {
  id: string;
  name: string;
  email: string;
  userId: string;
  isAdmin: boolean;
  isGodMode: boolean;
  onboardingComplete: boolean;
}

/**
 * Returns the current authenticated player. Cached per request via React.cache —
 * multiple server components calling this in the same render share one DB round-trip.
 */
export const getAuthPlayer = cache(async (): Promise<AuthPlayer | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: player } = await supabase
    .from("players")
    .select("id, name, email, is_admin, is_god_mode, onboarding_complete")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!player) return null;

  return {
    id: player.id,
    name: player.name,
    email: player.email,
    userId: user.id,
    isAdmin: player.is_admin ?? false,
    isGodMode: player.is_god_mode ?? false,
    onboardingComplete: player.onboarding_complete ?? false,
  };
});
