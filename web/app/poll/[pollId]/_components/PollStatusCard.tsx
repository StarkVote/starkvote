import type { PollDetails } from "../_lib/types";

type PollStatusCardProps = {
  pollData: PollDetails | null;
  registryFrozen: boolean | null;
  loadingState: boolean;
  canRefresh: boolean;
  onRefresh: () => void;
};

export function PollStatusCard({
  pollData,
  registryFrozen,
  loadingState,
  canRefresh,
  onRefresh,
}: PollStatusCardProps) {
  return (
    <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
      <h2 className="text-sm uppercase tracking-[0.2em] text-slate-300">Poll Status</h2>
      <p className="mt-3 text-sm">
        Exists:{" "}
        <span className="font-semibold text-slate-100">{pollData?.exists ? "Yes" : "No"}</span>
      </p>
      <p className="mt-1 text-sm">
        Frozen voter set:{" "}
        <span className="font-semibold text-slate-100">
          {registryFrozen === null ? "-" : registryFrozen ? "Yes" : "No"}
        </span>
      </p>
      <p className="mt-1 text-sm">
        Finalized:{" "}
        <span className="font-semibold text-slate-100">
          {pollData ? (pollData.finalized ? "Yes" : "No") : "-"}
        </span>
      </p>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loadingState || !canRefresh}
        className="mt-4 inline-flex h-10 items-center justify-center rounded-full border border-slate-500 px-4 text-sm text-slate-100 transition hover:border-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loadingState ? "Refreshing..." : "Refresh"}
      </button>
    </article>
  );
}
