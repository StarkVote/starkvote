import { PRIMARY_BUTTON_CLASS, TEXTAREA_CLASS } from "../../constants";

type StepAddEligibleProps = {
  eligibleInput: string;
  pollIdInput: string;
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
  pollIdInput,
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
      <h2 className="text-lg font-semibold text-zinc-950">Step 2: Add eligible voters</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Calls <code>add_eligible_batch(poll_id, addresses)</code>. The first caller for this poll
        becomes the registry admin.
      </p>
      <label className="mt-4 block text-sm font-medium text-zinc-700">
        Eligible addresses (space/comma separated)
        <textarea
          className={TEXTAREA_CLASS}
          value={eligibleInput}
          onChange={(event) => onEligibleInputChange(event.target.value)}
          placeholder="0x123..., 0x456..."
        />
      </label>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          onClick={() => void onAddEligibleBatch()}
          disabled={isBusy || !isWalletConnected || isFrozen}
        >
          {busyAction === "add_eligible_batch" ? "Submitting..." : "Add Eligible Batch"}
        </button>
      </div>
      {isFrozen ? (
        <p className="mt-3 text-xs text-amber-700">
          This poll ID is frozen. Select a new poll ID to add eligible voters.
        </p>
      ) : null}
      <p className="mt-3 text-xs text-zinc-500">
        Current leaf count for poll {pollIdInput}: {leafCount}
      </p>
    </div>
  );
}
