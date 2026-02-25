import type { LifecycleBadge } from "../types";
import { SECONDARY_BUTTON_CLASS } from "../constants";

type WizardHeaderProps = {
  lifecycle: LifecycleBadge;
  isBusy: boolean;
  onRefresh: () => void;
};

export function WizardHeader({ lifecycle, isBusy, onRefresh }: WizardHeaderProps) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">StarkVote</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
          Poll Creation Wizard
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          Step-driven flow based on contract ABI: connect wallet first, then progressively complete
          voter setup, freeze, and poll creation.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${lifecycle.tone}`}>
          {lifecycle.label}
        </span>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={onRefresh}
          disabled={isBusy}
        >
          Refresh
        </button>
      </div>
    </header>
  );
}
