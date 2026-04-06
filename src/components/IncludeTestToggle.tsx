"use client";

import { useRouter, usePathname } from "next/navigation";

export default function IncludeTestToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const pathname = usePathname();

  function toggle() {
    router.replace(!enabled ? `${pathname}?test=1` : pathname);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex items-center gap-2 text-xs text-gray-500"
      aria-label="Include test sessions"
    >
      <span className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${enabled ? "bg-blue-500" : "bg-gray-300"}`}>
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? "translate-x-4" : "translate-x-0"}`}
        />
      </span>
      <span>Test sessions</span>
    </button>
  );
}
