import type { WIZARD_STEPS } from "../constants";

type WizardStepperProps = {
  steps: typeof WIZARD_STEPS;
  currentStep: number;
  maxUnlockedStep: number;
  onStepClick: (step: number) => void;
};

export function WizardStepper({
  steps,
  currentStep,
  maxUnlockedStep,
  onStepClick,
}: WizardStepperProps) {
  return (
    <div className="mb-6 grid gap-2 sm:grid-cols-5">
      {steps.map((step) => {
        const unlocked = step.id <= maxUnlockedStep;
        const active = step.id === currentStep;

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepClick(step.id)}
            disabled={!unlocked}
            className={`rounded-xl border px-3 py-2 text-left transition ${
              active
                ? "border-zinc-900 bg-zinc-900 text-white"
                : unlocked
                  ? "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-500"
                  : "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400"
            }`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Step {step.id}</p>
            <p className="mt-1 text-sm font-medium">{step.label}</p>
          </button>
        );
      })}
    </div>
  );
}
