import { createClient } from "@/lib/supabase-server";
import { supabase as serviceClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const userName = user.user_metadata?.full_name ?? user.email ?? "Player";

  let { data: player } = await supabase
    .from("players")
    .select("id, onboarding_complete")
    .eq("user_id", user.id)
    .maybeSingle();

  // No player record yet — create a stub and send to onboarding.
  // This catches email users who logged in via signInWithPassword without
  // going through /auth/confirm first.
  if (!player) {
    const { data: newPlayer } = await serviceClient
      .from("players")
      .insert({
        user_id: user.id,
        name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Player",
        email: user.email!,
        skill_level: 2,
        is_admin: false,
        onboarding_complete: false,
      })
      .select("id, onboarding_complete")
      .single();
    player = newPlayer;
  }

  // Hard gate: any user who hasn't completed onboarding gets redirected.
  if (!player?.onboarding_complete) redirect("/onboarding");

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header userName={userName} playerId={player.id} />
      {/* pt-14 clears the fixed header, pb-16 clears the fixed bottom nav */}
      <main className="flex-1 pt-14 pb-16">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
