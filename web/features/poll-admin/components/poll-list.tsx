"use client";

import { useState } from "react";
import { usePollAdminStore, parsePollKey } from "../store";
import { getLifecycle, getMaxUnlockedStep, isConnectedWalletPollAdmin } from "../utils";

type PollEntry = {
  compositeKey: string;
  pollId: string;
  lifecycle: { label: string; tone: string };
  maxStep: number;
  eligibleCount: number;
  isAdmin: boolean;
};

type PollSwitcherProps = {
  currentWallet: string;
  isWalletConnected: boolean;
  activePollKey: string | null;
  pollIdInput: string;
  onNavigate: (step: number) => void;
  onStartNewPoll: () => void;
};

export function PollSwitcher({
  currentWallet,
  isWalletConnected,
  activePollKey,
  pollIdInput,
  onNavigate,
  onStartNewPoll,
}: PollSwitcherProps) {
  const [open, setOpen] = useState(false);
  const addressDataMap = usePollAdminStore((s) => s.addressDataMap);

  if (!isWalletConnected || !currentWallet || !pollIdInput) return null;

  const polls: PollEntry[] = [];
  for (const [compositeKey, data] of Object.entries(addressDataMap)) {
    if (!data.pollIdInput) continue;
    const { wallet } = parsePollKey(compositeKey);
    if (wallet.toLowerCase() !== currentWallet.toLowerCase()) continue;
    polls.push({
      compositeKey,
      pollId: data.pollIdInput,
      lifecycle: getLifecycle(data.status),
      maxStep: getMaxUnlockedStep(true, data.status),
      eligibleCount: (data.eligibleAddresses ?? []).length,
      isAdmin: isConnectedWalletPollAdmin(data.status, currentWallet),
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex cursor-pointer items-center gap-1.5 text-[10px] tabular-nums text-slate-500 transition hover:text-slate-300"
      >
        <span>Poll #{pollIdInput}</span>
        <svg
          className={`h-2.5 w-2.5 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-white/[0.08] bg-[#16161e] shadow-2xl">
            <div className="max-h-48 overflow-y-auto py-1">
              {polls.map((poll) => {
                const isActive = poll.compositeKey === activePollKey;
                return (
                  <button
                    key={poll.compositeKey}
                    type="button"
                    onClick={() => {
                      usePollAdminStore.getState().switchPoll(poll.compositeKey);
                      onNavigate(poll.maxStep);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition ${
                      isActive
                        ? "bg-violet-500/10 text-white"
                        : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">
                      #{poll.pollId}
                    </span>
                    <span className="shrink-0 text-[9px] text-slate-600">
                      {poll.eligibleCount}e
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-px text-[9px] font-medium ${poll.lifecycle.tone}`}
                    >
                      {poll.lifecycle.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => {
                  onStartNewPoll();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-violet-400 transition hover:bg-white/[0.04]"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New Poll
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
