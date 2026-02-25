import { formatUnixSeconds } from "@/lib/starkvote";

import type { PollDetails } from "../_lib/types";

type PollDetailsCardProps = {
  pollData: PollDetails | null;
  tallies: number[];
};

export function PollDetailsCard({ pollData, tallies }: PollDetailsCardProps) {
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
      <h2 className="text-lg font-semibold">On-chain poll details</h2>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <p>
          Options:{" "}
          <span className="font-semibold text-slate-100">{pollData?.optionsCount ?? "-"}</span>
        </p>
        <p>
          Start:{" "}
          <span className="font-semibold text-slate-100">
            {pollData ? formatUnixSeconds(pollData.startTime) : "-"}
          </span>
        </p>
        <p>
          End:{" "}
          <span className="font-semibold text-slate-100">
            {pollData ? formatUnixSeconds(pollData.endTime) : "-"}
          </span>
        </p>
        <p>
          Winner:{" "}
          <span className="font-semibold text-slate-100">
            {pollData?.finalized ? pollData.winnerOption : "-"}
          </span>
        </p>
      </div>
      <p className="mt-3 break-all font-mono text-xs text-slate-300">
        Snapshot root: {pollData?.snapshotRootHex ?? "-"}
      </p>
      {tallies.length > 0 ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {tallies.map((votes, option) => (
            <div
              key={option}
              className="rounded-xl border border-slate-700 bg-slate-950/70 p-3"
            >
              <p className="text-xs uppercase tracking-wide text-slate-400">Option {option}</p>
              <p className="mt-1 text-2xl font-semibold text-slate-100">{votes}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-400">No option tallies available yet.</p>
      )}
    </section>
  );
}
