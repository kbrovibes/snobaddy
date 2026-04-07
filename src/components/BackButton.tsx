"use client";

import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();
  return (
    <button onClick={() => router.back()} className="text-sm text-sky-600 hover:underline">
      ← Back
    </button>
  );
}
