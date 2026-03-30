import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && user) {
      // Check if player record already exists
      const { data: existingPlayer } = await supabase
        .from("players")
        .select("id, onboarding_complete")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existingPlayer) {
        // First login — create player record with defaults
        await supabase.from("players").insert({
          user_id: user.id,
          name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Player",
          email: user.email!,
          skill_level: 3,
          onboarding_complete: false,
        });
        return NextResponse.redirect(new URL("/onboarding", origin));
      }

      if (!existingPlayer.onboarding_complete) {
        return NextResponse.redirect(new URL("/onboarding", origin));
      }

      return NextResponse.redirect(new URL("/", origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_failed", origin));
}
