import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "../constants";

type WizardNavigationProps = {
  canGoPrevious: boolean;
  canGoNext: boolean;
  currentHint: string;
  onPrevious: () => void;
  onNext: () => void;
};

export function WizardNavigation({
  canGoPrevious,
  canGoNext,
  currentHint,
  onPrevious,
  onNext,
}: WizardNavigationProps) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4">
      <button
        type="button"
        className={SECONDARY_BUTTON_CLASS}
        onClick={onPrevious}
        disabled={!canGoPrevious}
      >
        Back
      </button>
      <p className="text-xs text-zinc-500">{currentHint}</p>
      <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={onNext} disabled={!canGoNext}>
        Next Step
      </button>
    </div>
  );
}
