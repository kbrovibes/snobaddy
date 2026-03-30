import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const userName = user.user_metadata?.full_name ?? user.email ?? "Player";

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header userName={userName} />
      {/* pt-14 clears the fixed header, pb-16 clears the fixed bottom nav */}
      <main className="flex-1 pt-14 pb-16">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
