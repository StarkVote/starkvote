import { formatUnixSeconds } from "@/lib/starkvote";
import {
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXTAREA_CLASS,
} from "../../constants";

type StepCreatePollProps = {
  optionsCountInput: string;
  durationInput: string;
  merkleRootInput: string;
  optionLabelsInput: string;
  busyAction: string;
  isBusy: boolean;
  isComputingRoot: boolean;
  isWalletConnected: boolean;
  onOptionsCountChange: (value: string) => void;
  onDurationChange: (value: string) => void;
  onMerkleRootChange: (value: string) => void;
  onOptionLabelsChange: (value: string) => void;
  onCreatePoll: () => Promise<void>;
  onComputeSnapshotRoot: () => Promise<void>;
};

export function StepCreatePoll({
  optionsCountInput,
  durationInput,
  merkleRootInput,
  optionLabelsInput,
  busyAction,
  isBusy,
  isComputingRoot,
  isWalletConnected,
  onOptionsCountChange,
  onDurationChange,
  onMerkleRootChange,
  onOptionLabelsChange,
  onCreatePoll,
  onComputeSnapshotRoot,
}: StepCreatePollProps) {
  const durationSecs = parseInt(durationInput, 10);
  const now = Math.floor(Date.now() / 1000);
  const validDuration = Number.isFinite(durationSecs) && durationSecs > 0;

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-950">Step 4: Create poll</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Calls <code>create_poll</code> with options, duration, and snapshot Merkle root.
        Start time is set to now, end time is now + duration.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-zinc-700">
          Options count
          <input
            className={INPUT_CLASS}
            value={optionsCountInput}
            onChange={(event) => onOptionsCountChange(event.target.value)}
            placeholder="2"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700">
          Duration (seconds)
          <input
            className={INPUT_CLASS}
            value={durationInput}
            onChange={(event) => onDurationChange(event.target.value)}
            placeholder="e.g. 120"
          />
          <span className="mt-1 block text-xs text-zinc-500">
            {validDuration
              ? `Poll will last ${durationSecs >= 60 ? `${Math.floor(durationSecs / 60)}m ${durationSecs % 60}s` : `${durationSecs}s`}`
              : "Enter duration in seconds"}
          </span>
        </label>
        <label className="block text-sm font-medium text-zinc-700 sm:col-span-2">
          Snapshot Merkle root (decimal or hex)
          <input
            className={INPUT_CLASS}
            value={merkleRootInput}
            onChange={(event) => onMerkleRootChange(event.target.value)}
            placeholder="0x..."
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700 sm:col-span-2">
          Option labels (one per line)
          <textarea
            className={TEXTAREA_CLASS}
            value={optionLabelsInput}
            onChange={(event) => onOptionLabelsChange(event.target.value)}
            placeholder={"Yes\\nNo"}
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={() => void onComputeSnapshotRoot()}
          disabled={isBusy || isComputingRoot}
        >
          {isComputingRoot ? "Computing root..." : "Auto Compute Root"}
        </button>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          onClick={() => void onCreatePoll()}
          disabled={isBusy || isComputingRoot || !isWalletConnected}
        >
          {busyAction === "create_poll" ? "Submitting..." : "Create Poll"}
        </button>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Start: now ({formatUnixSeconds(now)}) | End:{" "}
        {validDuration ? formatUnixSeconds(now + durationSecs) : "-"}
      </p>
    </div>
  );
}
