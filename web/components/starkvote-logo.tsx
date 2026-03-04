"use client";

export function StarkVoteLogo({ size = 160, className = "" }: { size?: number; className?: string }) {
  return (
    <div className={`animate-shield-glow ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
        <defs>
          <linearGradient id="shieldGrad" x1="40" y1="20" x2="160" y2="180" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="50%" stopColor="#633CFF" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
          <linearGradient id="innerGrad" x1="70" y1="50" x2="130" y2="150" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#633CFF" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="checkGrad" x1="75" y1="90" x2="125" y2="130" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#c4b5fd" />
          </linearGradient>
        </defs>

        {/* Shield body */}
        <path
          d="M100 22 L155 50 C155 50 158 110 100 170 C42 110 45 50 45 50 Z"
          fill="url(#shieldGrad)"
          stroke="url(#innerGrad)"
          strokeWidth="1.5"
          opacity="0.95"
        />

        {/* Shield inner facets */}
        <path
          d="M100 32 L145 55 C145 55 147 108 100 158 C53 108 55 55 55 55 Z"
          fill="none"
          stroke="#c4b5fd"
          strokeOpacity="0.15"
          strokeWidth="0.8"
        />

        {/* Check mark */}
        <path
          d="M78 102 L93 117 L125 82"
          stroke="url(#checkGrad)"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

export function StarkVoteLogoInline({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <StarkVoteLogo size={40} className="!animate-none" />
      <span className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight text-white">
        Stark<span className="text-violet-accent">Vote</span>
      </span>
    </div>
  );
}
