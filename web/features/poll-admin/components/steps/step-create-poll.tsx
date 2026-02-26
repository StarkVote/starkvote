import { useCallback, useMemo } from "react";
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "../../constants";

type StepCreatePollProps = {
  durationInput: string;
  optionLabelsInput: string;
  busyAction: string;
  isBusy: boolean;
  isComputingRoot: boolean;
  isWalletConnected: boolean;
  onDurationChange: (value: string) => void;
  onOptionLabelsChange: (value: string) => void;
  onCreatePoll: () => Promise<void>;
};

const DURATION_PRESETS = [
  { label: "2 min", seconds: 120 },
  { label: "10 min", seconds: 600 },
  { label: "1 hr", seconds: 3600 },
  { label: "24 hr", seconds: 86400 },
];

export function StepCreatePoll({
  durationInput,
  optionLabelsInput,
  busyAction,
  isBusy,
  isComputingRoot,
  isWalletConnected,
  onDurationChange,
  onOptionLabelsChange,
  onCreatePoll,
}: StepCreatePollProps) {
  const labels = useMemo(
    () => optionLabelsInput.split("\n"),
    [optionLabelsInput],
  );

  const updateLabel = useCallback(
    (index: number, value: string) => {
      const next = [...labels];
      next[index] = value;
      onOptionLabelsChange(next.join("\n"));
    },
    [labels, onOptionLabelsChange],
  );

  const removeLabel = useCallback(
    (index: number) => {
      const next = labels.filter((_, i) => i !== index);
      onOptionLabelsChange(next.join("\n"));
    },
    [labels, onOptionLabelsChange],
  );

  const addLabel = useCallback(() => {
    onOptionLabelsChange(optionLabelsInput + "\n");
  }, [optionLabelsInput, onOptionLabelsChange]);

  const activeDuration = Number(durationInput) || 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Option labels */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Options
        </span>
        <div className="flex flex-col gap-2">
          {labels.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-center text-[11px] text-slate-500">
                {i + 1}
              </span>
              <input
                className={INPUT_CLASS}
                value={label}
                onChange={(e) => updateLabel(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
              />
              {labels.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeLabel(i)}
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/[0.06] hover:text-red-400"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addLabel}
          className="mt-1 flex h-8 cursor-pointer items-center gap-1.5 self-start rounded-lg border border-dashed border-white/[0.1] px-3 text-xs text-slate-400 transition hover:border-violet-500/40 hover:text-violet-400"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add option
        </button>
      </div>

      {/* Duration */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Duration
        </span>
        <div className="flex flex-wrap gap-2">
          {DURATION_PRESETS.map((preset) => (
            <button
              key={preset.seconds}
              type="button"
              onClick={() => onDurationChange(String(preset.seconds))}
              className={`inline-flex h-8 cursor-pointer items-center rounded-lg border px-3 text-xs font-medium transition ${
                activeDuration === preset.seconds
                  ? "border-violet-500/50 bg-violet-500/15 text-violet-300"
                  : "border-white/[0.08] bg-white/[0.04] text-slate-400 hover:border-white/[0.15] hover:text-slate-300"
              }`}
            >
              {preset.label}
            </button>
          ))}
          <div className="flex items-center gap-1.5">
            <input
              className={`${INPUT_CLASS} !h-8 !w-20 text-center text-xs`}
              value={durationInput}
              onChange={(e) => onDurationChange(e.target.value)}
              placeholder="sec"
            />
            <span className="text-[11px] text-slate-500">sec</span>
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        type="button"
        className={PRIMARY_BUTTON_CLASS}
        onClick={() => void onCreatePoll()}
        disabled={isBusy || isComputingRoot || !isWalletConnected}
      >
        {busyAction === "create_poll"
          ? "Submitting..."
          : isComputingRoot
            ? "Computing root..."
            : "Open Poll"}
      </button>
    </div>
  );
}
