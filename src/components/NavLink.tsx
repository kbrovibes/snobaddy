"use client";

import Link from "next/link";
import { useNavigationLoader } from "./NavigationLoader";
import type { ComponentProps } from "react";

type NavLinkProps = ComponentProps<typeof Link>;

export default function NavLink({ onClick, ...props }: NavLinkProps) {
  const { startLoading } = useNavigationLoader();

  return (
    <Link
      {...props}
      onClick={(e) => {
        startLoading();
        onClick?.(e);
      }}
    />
  );
}
