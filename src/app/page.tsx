import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data, error } = await supabase
    .from("health_check")
    .select("message")
    .limit(1)
    .maybeSingle();

  const dbStatus = error
    ? `DB error: ${error.message}`
    : `DB says: "${data?.message ?? "no rows yet"}"`;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold">Hello World</h1>
      <p className="text-lg text-gray-600">{dbStatus}</p>
    </main>
  );
}
