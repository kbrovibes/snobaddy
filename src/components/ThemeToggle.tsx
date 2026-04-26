"use client";

import { useTheme } from "@/components/ThemeProvider";

const options = [
  { value: "light" as const, label: "Light", icon: "☀️" },
  { value: "dark" as const, label: "Dark", icon: "🌙" },
  { value: "system" as const, label: "Auto", icon: "⚙️" },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1 bg-surface-alt rounded-lg p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            theme === opt.value
              ? "bg-surface text-heading shadow-sm"
              : "text-muted hover:text-heading"
          }`}
        >
          <span className="text-xs">{opt.icon}</span>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
