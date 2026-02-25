import { useEffect, useState } from "react";

import { PRIMARY_BUTTON_CLASS } from "../../constants";
import type { Tally } from "../../types";

type StepManagePollProps = {
  tallies: Tally[];
  optionLabels: string[];
  hasPoll: boolean;
  endTime: number;
  finalized: boolean;
  busyAction: string;
  isBusy: boolean;
  isWalletConnected: boolean;
  onFinalizePoll: () => Promise<void>;
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
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function StepManagePoll({
  tallies,
  optionLabels,
  hasPoll,
  endTime,
  finalized,
  busyAction,
  isBusy,
  isWalletConnected,
  onFinalizePoll,
}: StepManagePollProps) {
  const remaining = useCountdown(endTime);
  const ended = endTime > 0 && remaining <= 0;
  const maxVotes = Math.max(1, ...tallies.map((t) => t.votes));

  return (
    <div>
      {hasPoll && endTime > 0 ? (
        <div className="mb-5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3">
          {finalized ? (
            <p className="text-sm font-medium text-emerald-400">Poll finalized.</p>
          ) : ended ? (
            <p className="text-sm font-medium text-amber-400">Poll ended. Ready to finalize.</p>
          ) : (
            <p className="text-sm text-slate-400">
              Ends in{" "}
              <span className="font-semibold text-white">
                {formatCountdown(remaining)}
              </span>
            </p>
          )}
        </div>
      ) : null}

      <div className="space-y-2">
        {hasPoll && tallies.length ? (
          tallies.map((item) => (
            <div
              key={item.option}
              className="relative overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3"
            >
              <div
                className="absolute inset-y-0 left-0 bg-violet-500/10 transition-all duration-500"
                style={{ width: `${(item.votes / maxVotes) * 100}%` }}
              />
              <div className="relative flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">
                  {optionLabels[item.option] || `Option ${item.option}`}
                </span>
                <span className="text-sm font-semibold text-white tabular-nums">
                  {item.votes}
                </span>
              </div>
            </div>
          ))
        ) : (
          <p className="py-4 text-center text-sm text-slate-600">Waiting for votes...</p>
        )}
      </div>

      <div className="mt-5 flex justify-center">
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          onClick={() => void onFinalizePoll()}
          disabled={isBusy || !isWalletConnected || finalized}
        >
          {busyAction === "finalize" ? "Submitting..." : "Finalize Poll"}
        </button>
      </div>
    </div>
  );
}
