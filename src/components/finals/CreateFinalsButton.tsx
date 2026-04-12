"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNavigationLoader } from "@/components/NavigationLoader";

export default function CreateFinalsButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { startLoading } = useNavigationLoader();

  async function handleCreate() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/finals", { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      // If already exists, navigate to it
      if (res.status === 409 && json.id) {
        startLoading();
        router.push(`/finals/${json.id}`);
        return;
      }
      setError(json.error ?? "Something went wrong");
      setLoading(false);
      return;
    }
    startLoading();
    router.push(`/finals/${json.id}`);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleCreate}
        disabled={loading}
        className="w-full py-3 bg-amber-500 text-white font-semibold rounded-xl disabled:opacity-50 hover:bg-amber-600 active:bg-amber-700 transition-colors"
      >
        {loading ? "Creating…" : "🏆 Create Finals Event"}
      </button>
      {error && <p className="text-xs text-red-500 text-center">{error}</p>}
    </div>
  );
}
