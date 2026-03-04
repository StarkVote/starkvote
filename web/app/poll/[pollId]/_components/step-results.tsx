import { formatUnixSeconds } from "@/lib/starkvote";

import type { PollDetails } from "../_lib/types";

type StepResultsProps = {
  pollData: PollDetails | null;
  tallies: number[];
  optionLabels: string[];
  questionText?: string | null;
};

export function StepResults({
  pollData,
  tallies,
  optionLabels,
  questionText,
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

  const isLive = pollData?.exists && pollData.endTime > 0 && Math.floor(Date.now() / 1000) < pollData.endTime;

  if (tallies.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.03]">
          <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </div>
        <p className="text-sm text-slate-500">No votes recorded yet.</p>
      </div>
    );
  }

  // Find the leading option(s)
  const maxTally = Math.max(...tallies);
  const leadingIndices = tallies.reduce<number[]>((acc, v, i) => (v === maxTally && v > 0 ? [...acc, i] : acc), []);

  return (
    <div className="space-y-5">
      {/* Status badge */}
      <div className="flex items-center justify-center">
        {winnerText ? (
          <div className="flex items-center gap-2 rounded-full border border-[#633CFF]/25 bg-[#633CFF]/10 px-4 py-1.5">
            <svg className="h-3.5 w-3.5 text-[#a78bfa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-4.5A3.375 3.375 0 0013.125 10.875h-2.25A3.375 3.375 0 007.5 14.25v4.5m6-12V3.75m-3.75 1.5L8.25 3.75m7.5 1.5l1.5-1.5" />
            </svg>
            <span className="text-xs font-medium text-[#c4b5fd]">Winner: {winnerText}</span>
          </div>
        ) : isLive ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-950/20 px-3.5 py-1.5 text-xs font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Live results
          </span>
        ) : pollData?.finalized ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-slate-400">
            Finalized
          </span>
        ) : null}
      </div>

      {/* Results bars */}
      <div className="space-y-2.5">
        {tallies.map((votes, option) => {
          const label = optionLabels[option] || `Option ${option}`;
          const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const isLeading = leadingIndices.includes(option) && totalVotes > 0;
          return (
            <div key={option} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className={`text-sm font-medium ${isLeading ? "text-white" : "text-slate-400"}`}>
                  {label}
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-lg font-bold tabular-nums ${isLeading ? "text-white" : "text-slate-400"}`}>
                    {votes}
                  </span>
                  {totalVotes > 0 && (
                    <span className="text-xs tabular-nums text-slate-500">{pct}%</span>
                  )}
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${isLeading
                      ? "bg-gradient-to-r from-[#633CFF] to-[#7c5cff]"
                      : "bg-white/[0.12]"
                    }`}
                  style={{ width: `${totalVotes > 0 ? pct : 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          <span><span className="font-medium text-slate-300">{totalVotes}</span> {totalVotes === 1 ? "vote" : "votes"}</span>
        </div>
        {pollData && pollData.endTime > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{isLive ? "Ends" : "Ended"}: <span className="text-slate-300">{formatUnixSeconds(pollData.endTime)}</span></span>
          </div>
        )}
      </div>
    </div>
  );
}
