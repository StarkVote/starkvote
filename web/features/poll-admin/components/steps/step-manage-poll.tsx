import { useEffect, useState } from "react";

import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "../../constants";
import type { Tally } from "../../types";

type StepManagePollProps = {
  tallies: Tally[];
  optionLabels: string[];
  hasPoll: boolean;
  endTime: number;
  finalized: boolean;
  isDraw: boolean;
  winnerOption: number;
  busyAction: string;
  isBusy: boolean;
  isWalletConnected: boolean;
  pollId: string;
  onFinalizePoll: () => Promise<void>;
  questionText?: string | null;
};

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

export function StepManagePoll({
  tallies,
  optionLabels,
  hasPoll,
  endTime,
  finalized,
  isDraw,
  winnerOption,
  busyAction,
  isBusy,
  isWalletConnected,
  pollId,
  onFinalizePoll,
  questionText,
}: StepManagePollProps) {
  const remaining = useCountdown(endTime);
  const ended = endTime > 0 && remaining <= 0;
  const totalVotes = tallies.reduce((sum, t) => sum + t.votes, 0);
  const maxVotes = Math.max(1, ...tallies.map((t) => t.votes));
  const [copied, setCopied] = useState(false);
  const winnerIndex =
    finalized && !isDraw && winnerOption >= 0 && winnerOption < tallies.length
      ? winnerOption
      : -1;

  const shareUrl =
    typeof window !== "undefined" && pollId
      ? `${window.location.origin}/poll/${pollId}`
      : "";

  const copyLink = () => {
    if (!shareUrl) return;
    void navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div>

      {hasPoll && endTime > 0 ? (
        <div className="mb-6 rounded-xl border border-white/6 bg-white/3 px-5 py-4">
          {finalized ? (
            <div className="flex items-center gap-2.5">
              <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              <p className="text-base font-medium text-emerald-400">
                Poll finalized{isDraw ? " as draw" : ""}
                {totalVotes > 0 && (
                  <span className="ml-2 font-normal text-slate-500">
                    &middot; {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
                  </span>
                )}
              </p>
            </div>
          ) : ended ? (
            <p className="text-base font-medium text-amber-400">Poll ended &middot; ready to finalize</p>
          ) : (
            <p className="text-base text-slate-400">
              Ends in{" "}
              <span className="font-semibold text-white">
                {formatCountdown(remaining)}
              </span>
              {totalVotes > 0 && (
                <span className="ml-2 text-slate-500">
                  &middot; {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
                </span>
              )}
            </p>
          )}
        </div>
      ) : null}

      <div className="space-y-3">
        {hasPoll && tallies.length ? (
          tallies.map((item, i) => {
            const pct = totalVotes > 0 ? (item.votes / totalVotes) * 100 : 0;
            const isWinner = finalized && !isDraw && i === winnerIndex && totalVotes > 0;
            return (
              <div
                key={item.option}
                className={`relative overflow-hidden rounded-xl border px-5 py-4 ${
                  isWinner
                    ? "border-emerald-500/30 bg-emerald-500/6"
                    : "border-white/6 bg-white/3"
                }`}
              >
                <div
                  className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                    isWinner ? "bg-emerald-500/15" : "bg-stark-purple/10"
                  }`}
                  style={{ width: `${(item.votes / maxVotes) * 100}%` }}
                />
                <div className="relative flex items-center justify-between">
                  <span className="flex items-center gap-2.5 text-base font-medium text-slate-300">
                    {isWinner && (
                      <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                    {optionLabels[item.option] || `Option ${item.option}`}
                  </span>
                  <span className="flex items-center gap-2.5 text-base tabular-nums">
                    <span className="font-semibold text-white">{item.votes}</span>
                    {totalVotes > 0 && (
                      <span className="text-sm text-slate-500">{pct.toFixed(0)}%</span>
                    )}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <p className="py-6 text-center text-base text-slate-600">Waiting for votes...</p>
        )}
      </div>

      {!finalized && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => void onFinalizePoll()}
            disabled={isBusy || !isWalletConnected || !ended}
          >
            {busyAction === "finalize" ? "Submitting..." : "Finalize Poll"}
          </button>
        </div>
      )}
    </div>
  );
}
