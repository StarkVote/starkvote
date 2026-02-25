import { PRIMARY_BUTTON_CLASS, TEXTAREA_CLASS } from "../../constants";

type StepAddEligibleProps = {
  eligibleInput: string;
  leafCount: number;
  isFrozen: boolean;
  busyAction: string;
  isBusy: boolean;
  isWalletConnected: boolean;
  onEligibleInputChange: (value: string) => void;
  onAddEligibleBatch: () => Promise<void>;
};

export function StepAddEligible({
  eligibleInput,
  leafCount,
  isFrozen,
  busyAction,
  isBusy,
  isWalletConnected,
  onEligibleInputChange,
  onAddEligibleBatch,
}: StepAddEligibleProps) {
  return (
    <div>
      <textarea
        className={TEXTAREA_CLASS}
        value={eligibleInput}
        onChange={(event) => onEligibleInputChange(event.target.value)}
        placeholder="Paste eligible wallet addresses (space or comma separated)"
      />
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          onClick={() => void onAddEligibleBatch()}
          disabled={isBusy || !isWalletConnected || isFrozen}
        >
          {busyAction === "add_eligible_batch" ? "Submitting..." : "Add Batch"}
        </button>
        <span className="text-xs text-slate-600">{leafCount} registered</span>
      </div>
    </div>
  );
}
