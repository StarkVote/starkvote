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
  pollData: PollDetails | null;
  optionLabels: string[];
  selectedOption: number | null;
  onOptionSelect: (option: number) => void;
  identityInput: string;
  onIdentityInputChange: (value: string) => void;
  hasSessionIdentity: boolean;
  onVote: () => void;
  voting: boolean;
  voteProgress: string | null;
  voteTx: string | null;
  generatedProofDisplay: string | null;
};

export function StepVote({
  pollData,
  optionLabels,
  selectedOption,
  onOptionSelect,
  identityInput,
  onIdentityInputChange,
  hasSessionIdentity,
  onVote,
  voting,
  voteProgress,
  voteTx,
  generatedProofDisplay,
}: StepVoteProps) {
  const optionCount = pollData?.optionsCount ?? 0;
  const options = Array.from({ length: optionCount }, (_, i) => i);
  const pollReady = pollData !== null && pollData.exists && optionCount > 0;
  const endTime = pollData?.endTime ?? 0;
  const remaining = useCountdown(endTime);
  const ended = endTime > 0 && remaining <= 0;
  const canVote =
    pollReady &&
    !ended &&
    selectedOption !== null &&
    (identityInput.trim().length > 0 || hasSessionIdentity) &&
    !voting;

  /* Poll not ready yet — show waiting state */
  if (!pollReady) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="relative flex h-10 w-10 items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-violet-500/20 border-t-violet-500" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-300">
            Waiting for poll to open…
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {pollData === null
              ? "Loading poll data…"
              : !pollData.exists
                ? "Poll has not been activated yet."
                : "No options configured yet."}
          </p>
          <p className="mt-3 text-[10px] text-slate-600">
            Checking automatically every 15s
          </p>
        </div>
      </div>
    );
  }

  /* Poll is ready — show voting UI */
  return (
    <div className="space-y-4">
      {endTime > 0 && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3">
          {ended ? (
            <p className="text-sm font-medium text-amber-400">
              Voting has ended
            </p>
          ) : (
            <p className="text-sm text-slate-400">
              Ends in{" "}
              <span className="font-semibold text-white">
                {formatCountdown(remaining)}
              </span>
            </p>
          )}
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-slate-300">Select option</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((option) => {
            const label = optionLabels[option] || `Option ${option}`;
            const isSelected = selectedOption === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onOptionSelect(option)}
                disabled={voting}
                className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                  isSelected
                    ? "border-violet-500 bg-violet-500/20 text-violet-100"
                    : "border-white/[0.08] bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Identity — collapsible, since it's usually auto-set */}
      <details className="group rounded-lg border border-white/[0.06] bg-white/[0.02]">
        <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs text-slate-400 select-none">
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
              <span className="text-violet-400">(auto)</span>
            ) : identityInput.trim() ? (
              <span className="text-violet-400">(custom)</span>
            ) : null}
          </span>
        </summary>
        <div className="border-t border-white/[0.04] px-3 pb-3 pt-2">
          {hasSessionIdentity && !identityInput.trim() ? (
            <p className="mb-1.5 text-[11px] text-violet-300/70">
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

      <button
        type="button"
        onClick={onVote}
        disabled={!canVote}
        className={`${PRIMARY_BUTTON_CLASS} h-11 w-full`}
      >
        {voting ? (voteProgress ?? "Processing…") : ended ? "Voting Closed" : "Vote"}
      </button>

      {generatedProofDisplay ? (
        <details className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
          <summary className="cursor-pointer text-xs text-slate-400">
            View generated proof
          </summary>
          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] text-slate-400">
            {generatedProofDisplay}
          </pre>
        </details>
      ) : null}

      {voteTx ? (
        <p className="text-xs text-violet-300">
          Tx: <span className="font-mono">{voteTx}</span>
        </p>
      ) : null}
    </div>
  );
}
