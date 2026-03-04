import Link from "next/link";
import { TopNav } from "@/components/top-nav";

function ShieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  );
}

function EyeOffIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

function CheckBadgeIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.745 3.745 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
    </svg>
  );
}

function BoltIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: EyeOffIcon,
    title: "Truly Anonymous",
    description:
      "Zero-knowledge proofs ensure no one — not even the poll creator — can link a vote to a voter.",
  },
  {
    icon: ShieldIcon,
    title: "On-Chain Integrity",
    description:
      "Every vote is verified by a Groth16 proof on Starknet. Results are tamper-proof and publicly auditable.",
  },
  {
    icon: CheckBadgeIcon,
    title: "Verifiable Results",
    description:
      "Anyone can independently verify the tally. No trust required — the math speaks for itself.",
  },
  {
    icon: BoltIcon,
    title: "Built on Starknet",
    description:
      "Leverage Starknet L2 for low-cost, high-throughput voting without compromising security.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Register Voters",
    description:
      "The poll admin adds eligible wallet addresses. Each voter registers a cryptographic commitment to join the voter set.",
  },
  {
    number: "02",
    title: "Cast Your Vote",
    description:
      "Voters generate a ZK proof off-chain that proves group membership without revealing identity, then submit it on-chain.",
  },
  {
    number: "03",
    title: "See the Results",
    description:
      "Votes are tallied on-chain. Anyone can verify the count. Nullifiers prevent double-voting while keeping ballots unlinkable.",
  },
];

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a12]">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(99,60,255,0.15)_0%,transparent_60%),radial-gradient(ellipse_at_80%_80%,rgba(79,70,229,0.08)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(1px_1px_at_20%_30%,rgba(255,255,255,0.15),transparent),radial-gradient(1px_1px_at_40%_70%,rgba(255,255,255,0.1),transparent),radial-gradient(1px_1px_at_60%_20%,rgba(255,255,255,0.12),transparent),radial-gradient(1px_1px_at_80%_50%,rgba(255,255,255,0.08),transparent)]" />
      </div>

      <TopNav>
        <Link
          href="/admin"
          className="inline-flex h-9 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.05] px-4 text-sm font-medium text-slate-300 transition hover:bg-white/[0.1] hover:text-white"
        >
          Admin Dashboard
        </Link>
      </TopNav>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 pt-16 pb-24 text-center md:pt-24 md:pb-32">
        <div className="animate-fade-up flex flex-wrap justify-center gap-3">
          {["ZK-Proof Privacy", "Starknet L2", "Verifiable Results"].map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[#633CFF]/20 bg-[#633CFF]/[0.08] px-3.5 py-1 text-xs font-medium text-[#a78bfa]"
            >
              {tag}
            </span>
          ))}
        </div>

        <h1 className="animate-fade-up-delay mt-8 font-[family-name:var(--font-heading)] text-5xl font-bold leading-[1.1] tracking-tight md:text-7xl">
          <span className="bg-gradient-to-br from-white via-[#c4b5fd] to-[#818cf8] bg-clip-text text-transparent">
            Anonymous Voting,
          </span>
          <br />
          <span className="bg-gradient-to-br from-[#a78bfa] to-[#633CFF] bg-clip-text text-transparent">
            Proven On-Chain
          </span>
        </h1>

        <p className="animate-fade-up-delay-2 mt-6 max-w-2xl text-lg leading-relaxed text-slate-400 md:text-xl">
          StarkVote lets anyone create tamper-proof polls where votes are anonymous by math, not by trust.
          Powered by Semaphore zero-knowledge proofs and verified on Starknet.
        </p>

        <div className="animate-fade-in mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/admin"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-[#633CFF] to-[#4f46e5] px-7 text-base font-medium text-white shadow-[0_0_20px_-4px_rgba(99,60,255,0.5)] transition hover:from-[#7c5cff] hover:to-[#6366f1] hover:shadow-[0_0_24px_-4px_rgba(99,60,255,0.65)]"
          >
            Create a Poll
          </Link>
          <a
            href="https://github.com/StarkVote/starkvote"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.05] px-7 text-base font-medium text-slate-300 transition hover:bg-white/[0.1] hover:text-white"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" clipRule="evenodd" />
            </svg>
            View on GitHub
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-24 md:pb-32">
        <div className="grid gap-5 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-white/[0.06] bg-white/[0.03] p-7 transition hover:border-[#633CFF]/15 hover:bg-[#633CFF]/[0.03]"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] transition group-hover:border-[#633CFF]/20 group-hover:bg-[#633CFF]/[0.06]">
                <feature.icon className="h-5 w-5 text-[#a78bfa]" />
              </div>
              <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-24 md:pb-32">
        <h2 className="mb-4 text-center font-[family-name:var(--font-heading)] text-3xl font-bold tracking-tight text-white md:text-4xl">
          How It Works
        </h2>
        <p className="mx-auto mb-14 max-w-xl text-center text-base text-slate-400">
          Three steps to a fully private, on-chain vote — no trusted third party needed.
        </p>

        <div className="grid gap-8 md:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number} className="relative">
              <span className="font-[family-name:var(--font-heading)] text-4xl font-bold text-[#633CFF]/20">
                {step.number}
              </span>
              <h3 className="mt-2 font-[family-name:var(--font-heading)] text-lg font-semibold text-white">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Tech stack */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-24 md:pb-32">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-8 md:p-12">
          <h2 className="mb-3 text-center font-[family-name:var(--font-heading)] text-2xl font-bold text-white md:text-3xl">
            Under the Hood
          </h2>
          <p className="mx-auto mb-10 max-w-lg text-center text-sm text-slate-400">
            Built with proven cryptographic primitives and battle-tested infrastructure.
          </p>

          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              { name: "Semaphore v4", detail: "ZK identity protocol" },
              { name: "Groth16", detail: "Succinct proof system" },
              { name: "Garaga", detail: "BN254 on Starknet" },
              { name: "Cairo", detail: "Smart contract language" },
            ].map((tech) => (
              <div key={tech.name} className="text-center">
                <p className="font-[family-name:var(--font-heading)] text-base font-semibold text-[#c4b5fd]">
                  {tech.name}
                </p>
                <p className="mt-1 text-xs text-slate-500">{tech.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-24 md:pb-32">
        <div className="flex flex-col items-center text-center">
          <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-white md:text-4xl">
            Ready to run a private vote?
          </h2>
          <p className="mt-4 max-w-md text-base text-slate-400">
            Set up your first anonymous poll in minutes. No backend servers, no data collection — just math and smart contracts.
          </p>
          <Link
            href="/admin"
            className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-[#633CFF] to-[#4f46e5] px-8 text-base font-medium text-white shadow-[0_0_20px_-4px_rgba(99,60,255,0.5)] transition hover:from-[#7c5cff] hover:to-[#6366f1] hover:shadow-[0_0_24px_-4px_rgba(99,60,255,0.65)]"
          >
            Get Started
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-slate-600">
            StarkVote — Anonymous on-chain voting powered by zero-knowledge proofs.
          </p>
          <div className="flex items-center gap-5">
            <a
              href="https://github.com/anthropics/starkvote"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 transition hover:text-slate-300"
            >
              GitHub
            </a>
            <a
              href="https://www.starknet.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 transition hover:text-slate-300"
            >
              Starknet
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
