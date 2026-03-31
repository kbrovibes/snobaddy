import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminEmail } from "@/lib/db/players";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "signup" | "recovery" | null;

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL("/login?error=auth_failed", origin));
  }

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

  const otpType = type === "recovery" ? "recovery" : "email";
  const { data: { user }, error } = await supabase.auth.verifyOtp({ token_hash, type: otpType });

  if (error || !user) {
    return NextResponse.redirect(new URL("/login?error=auth_failed", origin));
  }

  // Password recovery — session is established, send to reset form
  if (type === "recovery") {
    return NextResponse.redirect(new URL("/auth/reset-password", origin));
  }

  // Email confirmation — create player record if this is a new user
  const { data: existingPlayer } = await supabase
    .from("players")
    .select("id, onboarding_complete")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existingPlayer) {
    await supabase.from("players").insert({
      user_id: user.id,
      name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Player",
      email: user.email!,
      skill_level: 3,
      is_admin: isAdminEmail(user.email!),
      onboarding_complete: false,
    });
    return NextResponse.redirect(new URL("/onboarding", origin));
  }

  if (!existingPlayer.onboarding_complete) {
    return NextResponse.redirect(new URL("/onboarding", origin));
  }

  return NextResponse.redirect(new URL("/", origin));
}
