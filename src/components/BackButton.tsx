"use client";

import { useRouter } from "next/navigation";
import { useNavigationLoader } from "@/components/NavigationLoader";

export default function BackButton() {
  const router = useRouter();
  const { startLoading } = useNavigationLoader();
  return (
    <button
      onClick={() => { startLoading(); router.back(); }}
      className="text-sm text-sky-600 hover:text-sky-800 active:opacity-60 transition-opacity"
    >
      ‹ Back
    </button>
  );
}
