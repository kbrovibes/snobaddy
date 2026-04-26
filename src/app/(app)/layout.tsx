import { createClient } from "@/lib/supabase-server";
import { supabase as serviceClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import NavigationLoader from "@/components/NavigationLoader";
import PullToRefresh from "@/components/PullToRefresh";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import PushNotificationBanner from "@/components/PushNotificationBanner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let { data: player } = await supabase
    .from("players")
    .select("id, name, onboarding_complete, is_admin, is_god_mode")
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
      .select("id, name, onboarding_complete, is_admin, is_god_mode")
      .single();
    player = newPlayer;
  }

  // Hard gate: any user who hasn't completed onboarding gets redirected.
  if (!player?.onboarding_complete) redirect("/onboarding");

  return (
    <NavigationLoader>
      <div className="flex flex-col min-h-screen bg-background">
        <Header userName={player.name ?? user.email ?? "Player"} playerId={player.id} isAdmin={player.is_admin ?? false} isGodMode={player.is_god_mode ?? false} />
        {/* pt-14 clears the fixed header, pb-16 clears the fixed bottom nav */}
        <main className="flex-1 pt-14 pb-16">
          <PullToRefresh />
          <PushNotificationBanner vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? ""} />
          {children}
        </main>
        <BottomNav isAdmin={player?.is_admin ?? false} isGodMode={player?.is_god_mode ?? false} />
        <ServiceWorkerRegistration />
      </div>
    </NavigationLoader>
  );
}
