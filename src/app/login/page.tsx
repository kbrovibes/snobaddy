"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase-browser";

type Mode = "signin" | "signup" | "reset";

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasError = searchParams.get("error");

  const [mode, setMode] = useState<Mode>("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(hasError ? "Sign in failed. Please try again." : null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setSuccessMsg(null);
  }

  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      router.push("/");
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Display name is required.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: displayName.trim() },
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSuccessMsg(`Check your email — we sent a confirmation link to ${email}.`);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm`,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSuccessMsg("Check your email for a reset link.");
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 bg-gray-50">
      {/* Logo */}
      <div className="flex flex-col leading-tight items-center">
        <span className="font-bold text-gray-900 text-2xl">Serve Snoqualmie</span>
        <span className="font-black text-gray-900 text-xs tracking-[0.2em] uppercase">Badminton</span>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        {/* Google button */}
        <button
          onClick={signInWithGoogle}
          className="flex items-center justify-center gap-3 w-full px-6 py-3 bg-white border border-gray-300 rounded-lg shadow-sm text-gray-700 font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Mode toggle (only shown for signin/signup) */}
        {mode !== "reset" && (
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => switchMode("signin")}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mode === "signin" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Sign in
            </button>
            <button
              onClick={() => switchMode("signup")}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mode === "signup" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Create account
            </button>
          </div>
        )}

        {/* Success message */}
        {successMsg && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 text-center">
            {successMsg}
          </div>
        )}

        {/* Error message */}
        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        {/* Sign in form */}
        {mode === "signin" && !successMsg && (
          <form onSubmit={handleSignIn} className="flex flex-col gap-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-sky-600 text-white font-semibold rounded-lg disabled:opacity-40 hover:bg-sky-700 transition-colors"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={() => switchMode("reset")}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors text-center"
            >
              Forgot password?
            </button>
          </form>
        )}

        {/* Sign up form */}
        {mode === "signup" && !successMsg && (
          <form onSubmit={handleSignUp} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
            />
            <input
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-sky-600 text-white font-semibold rounded-lg disabled:opacity-40 hover:bg-sky-700 transition-colors"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        )}

        {/* Password reset form */}
        {mode === "reset" && !successMsg && (
          <form onSubmit={handleReset} className="flex flex-col gap-3">
            <p className="text-sm text-gray-600 text-center">
              Enter your email and we&apos;ll send you a reset link.
            </p>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-sky-600 text-white font-semibold rounded-lg disabled:opacity-40 hover:bg-sky-700 transition-colors"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors text-center"
            >
              ← Back to sign in
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
