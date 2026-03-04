import { useState } from "react";

type WizardHeaderProps = {
  isWalletConnected: boolean;
  walletAddress: string;
  isBusy: boolean;
  onDisconnect: () => Promise<void>;
};

function truncateAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WizardHeader({
  isWalletConnected,
  walletAddress,
  isBusy,
  onDisconnect,
}: WizardHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#a78bfa]/70">
          StarkVote
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-bold tracking-tight text-white">
          Poll Creation Wizard
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {isWalletConnected ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.05] px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/[0.1]"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              {truncateAddress(walletAddress)}
              <svg className="h-3 w-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {menuOpen ? (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-white/[0.08] bg-[#1a1035] shadow-2xl">
                  <div className="border-b border-white/[0.06] px-4 py-3">
                    <p className="truncate text-xs text-slate-500">Connected</p>
                    <p className="mt-0.5 truncate text-xs font-medium text-slate-300">
                      {walletAddress}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      void onDisconnect();
                    }}
                    disabled={isBusy}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs text-red-400 transition hover:bg-white/[0.04] disabled:opacity-40"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                    </svg>
                    Disconnect
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
