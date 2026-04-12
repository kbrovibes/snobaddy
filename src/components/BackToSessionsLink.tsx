"use client";

import NavLink from "@/components/NavLink";

export default function BackToSessionsLink() {
  return (
    <NavLink href="/?list=1" className="text-sm text-sky-600 hover:underline">
      ‹ All Sessions
    </NavLink>
  );
}
