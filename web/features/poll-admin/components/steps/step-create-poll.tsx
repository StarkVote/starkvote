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
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className={INPUT_CLASS}
          value={optionsCountInput}
          onChange={(event) => onOptionsCountChange(event.target.value)}
          placeholder="Options count"
        />
        <input
          className={INPUT_CLASS}
          value={durationInput}
          onChange={(event) => onDurationChange(event.target.value)}
          placeholder="Duration (seconds)"
        />
        <input
          className={`${INPUT_CLASS} sm:col-span-2`}
          value={merkleRootInput}
          onChange={(event) => onMerkleRootChange(event.target.value)}
          placeholder="Snapshot Merkle root"
        />
        <textarea
          className={`${TEXTAREA_CLASS} sm:col-span-2`}
          value={optionLabelsInput}
          onChange={(event) => onOptionLabelsChange(event.target.value)}
          placeholder="Option labels (one per line)"
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={() => void onComputeSnapshotRoot()}
          disabled={isBusy || isComputingRoot}
        >
          {isComputingRoot ? "Computing..." : "Auto Compute Root"}
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
    </div>
  );
}
