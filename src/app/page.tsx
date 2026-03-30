import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <span className="text-6xl">🏸</span>
      <h1 className="text-3xl font-bold text-gray-900">snobaddy</h1>
      <p className="text-gray-500">Welcome, {user?.user_metadata?.full_name ?? user?.email}</p>
      <p className="text-sm text-gray-400">Session view coming soon.</p>
    </main>
  );
}
