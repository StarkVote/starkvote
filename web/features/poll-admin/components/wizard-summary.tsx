import { formatUnixSeconds } from "@/lib/starkvote";
import { CARD_CLASS } from "../constants";
import type { PollStatus } from "../types";

type WizardSummaryProps = {
  pollIdInput: string;
  status: PollStatus | null;
  isWalletConnected: boolean;
  isPollAdmin: boolean;
  lastTxHash: string;
};

export function WizardSummary({
  pollIdInput,
  status,
  isWalletConnected,
  isPollAdmin,
  lastTxHash,
}: WizardSummaryProps) {
  return (
    <aside className={CARD_CLASS}>
      <h2 className="text-lg font-semibold text-zinc-950">Wizard Summary</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Real-time status for poll <span className="font-medium">{pollIdInput}</span>.
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <dt className="text-zinc-500">Wallet</dt>
        <dd className="font-medium text-zinc-900">{isWalletConnected ? "Connected" : "Disconnected"}</dd>

        <dt className="text-zinc-500">Registry frozen</dt>
        <dd className="font-medium text-zinc-900">{status?.frozen ? "Yes" : "No"}</dd>

        <dt className="text-zinc-500">Leaf count</dt>
        <dd className="font-medium text-zinc-900">{status?.leafCount ?? 0}</dd>

        <dt className="text-zinc-500">Poll exists</dt>
        <dd className="font-medium text-zinc-900">{status?.exists ? "Yes" : "No"}</dd>

        <dt className="text-zinc-500">Finalized</dt>
        <dd className="font-medium text-zinc-900">{status?.finalized ? "Yes" : "No"}</dd>

        <dt className="text-zinc-500">Poll admin</dt>
        <dd className="truncate font-medium text-zinc-900" title={status?.pollAdmin ?? "-"}>
          {status?.pollAdmin ?? "-"}
        </dd>
      </dl>

      <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
        <p>Connected wallet is admin: {isPollAdmin ? "Yes" : "No"}</p>
        <p className="mt-1">
          Poll window:{" "}
          {status
            ? `${formatUnixSeconds(status.startTime)} to ${formatUnixSeconds(status.endTime)}`
            : "-"}
        </p>
        <p className="mt-1 break-all">Snapshot root: {status?.snapshotRoot ?? "-"}</p>
      </div>

      {lastTxHash ? (
        <p className="mt-4 break-all rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
          Last transaction hash: {lastTxHash}
        </p>
      ) : null}
    </aside>
  );
}
