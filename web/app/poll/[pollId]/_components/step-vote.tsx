import { useEffect, useState } from "react";

import { PRIMARY_BUTTON_CLASS, TEXTAREA_CLASS } from "@/features/poll-admin/constants";

import type { PollDetails } from "../_lib/types";

function useCountdown(endTime: number) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, endTime - Math.floor(Date.now() / 1000)),
  );

  useEffect(() => {
    if (endTime <= 0) return;
    const tick = () =>
      setRemaining(Math.max(0, endTime - Math.floor(Date.now() / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  return remaining;
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

type StepVoteProps = {
  isConnected: boolean;
  connecting: boolean;
  sameAccountAsRegistrant: boolean;
  pollData: PollDetails | null;
  optionLabels: string[];
  selectedOption: number | null;
  onConnect: () => void;
  onOptionSelect: (option: number) => void;
  identityInput: string;
  onIdentityInputChange: (value: string) => void;
  hasSessionIdentity: boolean;
  onVote: () => void;
  voting: boolean;
  voteProgress: string | null;
  voteTx: string | null;
  generatedProofDisplay: string | null;
  questionText?: string | null;
};

export function StepVote({
  isConnected,
  connecting,
  sameAccountAsRegistrant,
  pollData,
  optionLabels,
  selectedOption,
  onConnect,
  onOptionSelect,
  identityInput,
  onIdentityInputChange,
  hasSessionIdentity,
  onVote,
  voting,
  voteProgress,
  voteTx,
  generatedProofDisplay,
  questionText,
}: StepVoteProps) {
  const optionCount = pollData?.optionsCount ?? 0;
  const options = Array.from({ length: optionCount }, (_, i) => i);
  const pollReady = pollData !== null && pollData.exists && optionCount > 0;
  const endTime = pollData?.endTime ?? 0;
  const remaining = useCountdown(endTime);
  const ended = endTime > 0 && remaining <= 0;
  const hasVoted = Boolean(voteTx);
  const optionsLocked = voting || ended || hasVoted;
  const canVote =
    isConnected &&
    pollReady &&
    !ended &&
    !hasVoted &&
    selectedOption !== null &&
    (identityInput.trim().length > 0 || hasSessionIdentity) &&
    !voting;

  /* Poll not ready yet — show waiting state */
  if (!pollReady) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="relative flex h-10 w-10 items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-[#633CFF]/20 border-t-[#633CFF]" />
        </div>
        <div className="text-center">
          <p className="text-md font-medium text-slate-300">
            Waiting for poll to open…
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {pollData === null
              ? "Loading poll data…"
              : !pollData.exists
                ? "Poll has not been activated yet."
                : "No options configured yet."}
          </p>
        </div>
      </div>
    );
  }

  /* Poll is ready — show voting UI */
  return (
    <div className="space-y-6">
      {isConnected && sameAccountAsRegistrant && !voteTx ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-950/20 px-3.5 py-2.5 text-xs leading-relaxed text-amber-200/80">
          <svg className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Same account used for registration — your wallet address will be exposed. Please vote with a different account.
        </div>
      ) : null}


      {/* Options as vertical cards */}
      <div className="space-y-2">
        {options.map((option) => {
          const label = optionLabels[option] || `Option ${option}`;
          const isSelected = selectedOption === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onOptionSelect(option)}
              disabled={optionsLocked}
              className={`group flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all ${isSelected
                ? "border-[#633CFF]/60 bg-[#633CFF]/10 shadow-[0_0_12px_-4px_rgba(99,60,255,0.3)]"
                : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.05]"
                } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <span
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition ${isSelected
                  ? "border-[#633CFF] bg-[#633CFF]"
                  : "border-white/20 group-hover:border-white/30"
                  }`}
              >
                {isSelected && (
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className={`text-sm font-medium ${isSelected ? "text-white" : "text-slate-300 group-hover:text-white"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
      <div className="space-y-2">
        {/* Identity — collapsible, since it's usually auto-set */}
        <details className="group rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <summary className="flex cursor-pointer items-center gap-2 px-3.5 py-2.5 text-xs text-slate-500 select-none">
            <svg
              className="h-3 w-3 transition-transform group-open:rotate-90"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span>
              Identity{" "}
              {hasSessionIdentity && !identityInput.trim() ? (
                <span className="text-emerald-400/70">&#10003; auto</span>
              ) : identityInput.trim() ? (
                <span className="text-[#a78bfa]">custom</span>
              ) : null}
            </span>
          </summary>
          <div className="border-t border-white/[0.04] px-3.5 pb-3 pt-2">
            {hasSessionIdentity && !identityInput.trim() ? (
              <p className="mb-1.5 text-[11px] text-[#c4b5fd]/70">
                Using identity from this session.
              </p>
            ) : null}
            <textarea
              value={identityInput}
              onChange={(e) => onIdentityInputChange(e.target.value)}
              rows={2}
              placeholder="Paste serialized identity or identity.json"
              disabled={voting}
              className={`${TEXTAREA_CLASS} min-h-0 font-mono text-xs disabled:opacity-60`}
              style={{ minHeight: "auto" }}
            />
          </div>
        </details>

        {generatedProofDisplay ? (
          <details className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <summary className="cursor-pointer text-xs text-slate-400">
              View generated proof
            </summary>
            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] text-slate-400">
              {generatedProofDisplay}
            </pre>
          </details>
        ) : null}

      </div>

      {/* Vote button */}
      <button
        type="button"
        onClick={isConnected ? onVote : onConnect}
        disabled={isConnected ? !canVote : connecting}
        className={`${PRIMARY_BUTTON_CLASS} h-12 w-full text-base`}
      >
        {isConnected
          ? voting
            ? (voteProgress ?? "Processing…")
            : ended
              ? "Voting Closed"
              : hasVoted
                ? "Vote Submitted"
                : selectedOption === null
                  ? "Select an option above"
                  : "Cast Vote"
          : connecting
            ? "Connecting…"
            : "Connect Wallet"}
      </button>

      {/* Timer badge */}
      {endTime > 0 && (
        <div className="flex items-center justify-end">
          {ended ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-950/30 px-3.5 py-1.5 text-xs font-medium text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Voting ended
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-950/20 px-3.5 py-1.5 text-xs font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              {formatCountdown(remaining)} remaining
            </span>
          )}
        </div>
      )}



      {voteTx ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-3 py-2">
          <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-xs text-emerald-300">
            Tx: <span className="font-mono text-emerald-400/80">{voteTx}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
