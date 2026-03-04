import { formatUnixSeconds } from "@/lib/starkvote";

import type { PollDetails } from "../_lib/types";

type StepResultsProps = {
  pollData: PollDetails | null;
  tallies: number[];
  optionLabels: string[];
};

export function StepResults({
  pollData,
  tallies,
  optionLabels,
}: StepResultsProps) {
  const maxVotes = tallies.length > 0 ? Math.max(...tallies, 1) : 1;
  const totalVotes = tallies.reduce((sum, v) => sum + v, 0);

  const winnerText = (() => {
    if (!pollData?.finalized) {
      return null;
    }
    if (pollData.isDraw) {
      return "Draw";
    }
    const index = pollData.winnerOption;
    return optionLabels[index] || `Option ${index}`;
  })();

  if (tallies.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <p className="text-sm text-slate-500">No votes recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {winnerText && (
        <div className="rounded-lg border border-[#633CFF]/20 bg-[#633CFF]/[0.08] px-4 py-3 text-center">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Winner
          </p>
          <p className="mt-0.5 text-lg font-semibold text-white">
            {winnerText}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {tallies.map((votes, option) => {
          const label = optionLabels[option] || `Option ${option}`;
          const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          return (
            <div
              key={option}
              className="relative overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.03] p-3"
            >
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#633CFF]/20 to-[#4f46e5]/20"
                style={{ width: `${(votes / maxVotes) * 100}%` }}
              />
              <div className="relative flex items-center justify-between">
                <p className="text-sm text-slate-300">{label}</p>
                <p className="text-sm text-slate-400">
                  <span className="text-lg font-semibold text-white">{votes}</span>
                  {totalVotes > 0 && (
                    <span className="ml-1.5 text-xs text-slate-500">{pct}%</span>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <p>
          Total votes: <span className="text-slate-300">{totalVotes}</span>
        </p>
        {pollData && pollData.endTime > 0 && (
          <p>
            Ended: <span className="text-slate-300">{formatUnixSeconds(pollData.endTime)}</span>
          </p>
        )}
      </div>
    </div>
  );
}
