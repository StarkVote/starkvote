import { useEffect, useState } from "react";

import { formatUnixSeconds } from "@/lib/starkvote";

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

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-950">Step 5: Manage and finalize</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Monitor option tallies and finalize after the poll ends. Tallies refresh automatically.
      </p>

      {hasPoll && endTime > 0 ? (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
          {finalized ? (
            <p className="text-sm font-medium text-emerald-700">Poll finalized.</p>
          ) : ended ? (
            <p className="text-sm font-medium text-amber-700">
              Poll ended ({formatUnixSeconds(endTime)}). Ready to finalize.
            </p>
          ) : (
            <p className="text-sm font-medium text-zinc-700">
              Poll ends in{" "}
              <span className="font-semibold text-zinc-900">
                {formatCountdown(remaining)}
              </span>{" "}
              ({formatUnixSeconds(endTime)})
            </p>
          )}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          onClick={() => void onFinalizePoll()}
          disabled={isBusy || !isWalletConnected || finalized}
        >
          {busyAction === "finalize" ? "Submitting..." : "Finalize Poll"}
        </button>
        {!ended && !finalized ? (
          <span className="text-xs text-zinc-500">
            Wait for the poll to end before finalizing.
          </span>
        ) : null}
        {ended && !finalized ? (
          <span className="text-xs text-amber-600">
            If finalize fails, wait a moment. Starknet block timestamps may lag behind.
          </span>
        ) : null}
      </div>

      <div className="mt-5 space-y-3">
        {hasPoll && tallies.length ? (
          tallies.map((item) => (
            <div
              key={item.option}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3"
            >
              <span className="text-sm font-medium text-zinc-700">
                Option {item.option}
                {optionLabels[item.option] ? ` - ${optionLabels[item.option]}` : ""}
              </span>
              <span className="text-sm font-semibold text-zinc-900">{item.votes} vote(s)</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-600">No tally data yet. Waiting for votes...</p>
        )}
      </div>
    </div>
  );
}
