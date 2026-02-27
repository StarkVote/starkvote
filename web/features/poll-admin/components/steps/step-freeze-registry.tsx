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
  if (isFrozen) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
          <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <p className="text-sm font-medium text-emerald-400">Registry frozen</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <p className="text-sm text-slate-500">Lock the voter set before creating a poll</p>
      <button
        type="button"
        className={PRIMARY_BUTTON_CLASS}
        onClick={() => void onFreezeRegistry()}
        disabled={isBusy || !isWalletConnected}
      >
        {busyAction === "freeze" ? "Submitting..." : "Freeze Registry"}
      </button>
    </div>
  );
}
