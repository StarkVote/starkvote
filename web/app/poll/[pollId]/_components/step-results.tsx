import { formatUnixSeconds } from "@/lib/starkvote";
import { SECONDARY_BUTTON_CLASS } from "@/features/poll-admin/constants";

import type { PollDetails } from "../_lib/types";

type StepResultsProps = {
  pollData: PollDetails | null;
  tallies: number[];
  optionLabels: string[];
  pollAddress: string;
  registryAddress: string;
  loading: boolean;
  onRefresh: () => void;
};

export function StepResults({
  pollData,
  tallies,
  optionLabels,
  pollAddress,
  registryAddress,
  loading,
  onRefresh,
}: StepResultsProps) {
  const maxVotes = tallies.length > 0 ? Math.max(...tallies, 1) : 1;

  return (
    <div className="space-y-4">
      {tallies.length > 0 ? (
        <div className="space-y-2">
          {tallies.map((votes, option) => {
            const label = optionLabels[option] || `Option ${option}`;
            return (
              <div
                key={option}
                className="relative overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.03] p-3"
              >
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-600/20 to-indigo-600/20"
                  style={{ width: `${(votes / maxVotes) * 100}%` }}
                />
                <div className="relative flex items-center justify-between">
                  <p className="text-sm text-slate-300">{label}</p>
                  <p className="text-lg font-semibold text-white">{votes}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No tallies yet.</p>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
        <p>
          Options:{" "}
          <span className="text-slate-200">
            {pollData?.optionsCount ?? "-"}
          </span>
        </p>
        <p>
          Start:{" "}
          <span className="text-slate-200">
            {pollData ? formatUnixSeconds(pollData.startTime) : "-"}
          </span>
        </p>
        <p>
          End:{" "}
          <span className="text-slate-200">
            {pollData ? formatUnixSeconds(pollData.endTime) : "-"}
          </span>
        </p>
        <p>
          Winner:{" "}
          <span className="text-slate-200">
            {pollData?.finalized ? pollData.winnerOption : "-"}
          </span>
        </p>
      </div>

      <p className="break-all font-mono text-[10px] text-slate-500">
        Root: {pollData?.snapshotRootHex ?? "-"}
      </p>

      <div className="space-y-1.5">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            Poll contract
          </p>
          <p className="mt-0.5 break-all font-mono text-xs text-slate-300">
            {pollAddress}
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            Registry
          </p>
          <p className="mt-0.5 break-all font-mono text-xs text-slate-300">
            {registryAddress}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className={`${SECONDARY_BUTTON_CLASS} w-full`}
      >
        {loading ? "Refreshing\u2026" : "Refresh"}
      </button>
    </div>
  );
}
