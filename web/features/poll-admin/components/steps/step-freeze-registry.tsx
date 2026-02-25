import { PRIMARY_BUTTON_CLASS } from "../../constants";

type StepFreezeRegistryProps = {
  isFrozen: boolean;
  busyAction: string;
  isBusy: boolean;
  isWalletConnected: boolean;
  onFreezeRegistry: () => Promise<void>;
};

export function StepFreezeRegistry({
  isFrozen,
  busyAction,
  isBusy,
  isWalletConnected,
  onFreezeRegistry,
}: StepFreezeRegistryProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-950">Step 3: Freeze registry</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Calls <code>freeze(poll_id)</code>. Poll creation is blocked until this is true.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          onClick={() => void onFreezeRegistry()}
          disabled={isBusy || !isWalletConnected}
        >
          {busyAction === "freeze" ? "Submitting..." : "Freeze Registry"}
        </button>
      </div>
      <p className="mt-3 text-xs text-zinc-500">Registry frozen: {isFrozen ? "Yes" : "No"}</p>
    </div>
  );
}
