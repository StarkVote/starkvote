"use client";

import Link from "next/link";
import { StarkVoteLogo } from "./starkvote-logo";

type TopNavProps = {
  /** Right-side content (wallet button, back link, etc.) */
  children?: React.ReactNode;
};

export function TopNav({ children }: TopNavProps) {
  return (
    <nav className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
      <Link href="/" className="flex items-center gap-3 transition hover:opacity-80">
        <StarkVoteLogo size={32} className="!animate-none" />
        <span className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-tight text-white">
          Stark<span className="text-[#a78bfa]">Vote</span>
        </span>
      </Link>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </nav>
  );
}
