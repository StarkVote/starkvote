import { useCallback, useMemo, useState } from "react";
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

function secondsToHM(totalSeconds: number): { hours: string; minutes: string } {
  if (totalSeconds <= 0) return { hours: "", minutes: "" };
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return { hours: h > 0 ? String(h) : "", minutes: m > 0 ? String(m) : "" };
}

function hmToSeconds(hours: string, minutes: string): number {
  return (parseInt(hours) || 0) * 3600 + (parseInt(minutes) || 0) * 60;
}

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

  const activeDuration = Number(durationInput) || 0;
  const isPreset = DURATION_PRESETS.some((p) => p.seconds === activeDuration);
  const [showCustom, setShowCustom] = useState(!isPreset && activeDuration > 0);
  const [customHours, setCustomHours] = useState(() => secondsToHM(activeDuration).hours);
  const [customMinutes, setCustomMinutes] = useState(() => secondsToHM(activeDuration).minutes);

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

  const handlePresetClick = (seconds: number) => {
    setShowCustom(false);
    onDurationChange(String(seconds));
  };

  const handleCustomClick = () => {
    setShowCustom(true);
    const { hours, minutes } = secondsToHM(activeDuration);
    setCustomHours(hours);
    setCustomMinutes(minutes);
  };

  const handleCustomChange = (hours: string, minutes: string) => {
    setCustomHours(hours);
    setCustomMinutes(minutes);
    const sec = hmToSeconds(hours, minutes);
    if (sec > 0) onDurationChange(String(sec));
  };

  // Format active duration for display
  const durationDisplay = useMemo(() => {
    if (activeDuration <= 0) return null;
    const h = Math.floor(activeDuration / 3600);
    const m = Math.floor((activeDuration % 3600) / 60);
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (parts.length === 0) parts.push(`${activeDuration}s`);
    return parts.join(" ");
  }, [activeDuration]);

  return (
    <div className="flex flex-col gap-6">
      {/* Option labels */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Options
        </span>
        <div className="flex flex-col gap-3">
          {labels.map((label, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-6 shrink-0 text-center text-xs text-slate-500">
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
                  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition hover:bg-white/[0.06] hover:text-red-400"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
          className="mt-1 flex h-10 cursor-pointer items-center gap-2 self-start rounded-xl border border-dashed border-white/[0.1] px-4 text-sm text-slate-400 transition hover:border-[#633CFF]/40 hover:text-[#a78bfa]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add option
        </button>
      </div>

      {/* Duration */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Duration
          </span>
          {durationDisplay && (
            <span className="text-xs text-slate-400">
              {durationDisplay}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {DURATION_PRESETS.map((preset) => (
            <button
              key={preset.seconds}
              type="button"
              onClick={() => handlePresetClick(preset.seconds)}
              className={`inline-flex h-10 cursor-pointer items-center rounded-xl border px-4 text-sm font-medium transition ${
                !showCustom && activeDuration === preset.seconds
                  ? "border-[#633CFF]/50 bg-[#633CFF]/15 text-[#c4b5fd]"
                  : "border-white/[0.08] bg-white/[0.04] text-slate-400 hover:border-white/[0.15] hover:text-slate-300"
              }`}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleCustomClick}
            className={`inline-flex h-10 cursor-pointer items-center rounded-xl border px-4 text-sm font-medium transition ${
              showCustom
                ? "border-[#633CFF]/50 bg-[#633CFF]/15 text-[#c4b5fd]"
                : "border-white/[0.08] bg-white/[0.04] text-slate-400 hover:border-white/[0.15] hover:text-slate-300"
            }`}
          >
            Custom
          </button>
        </div>
        {showCustom && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                className={`${INPUT_CLASS} !h-10 !w-20 text-center text-sm`}
                value={customHours}
                onChange={(e) => handleCustomChange(e.target.value, customMinutes)}
                placeholder="0"
              />
              <span className="text-xs text-slate-500">hr</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="59"
                className={`${INPUT_CLASS} !h-10 !w-20 text-center text-sm`}
                value={customMinutes}
                onChange={(e) => handleCustomChange(customHours, e.target.value)}
                placeholder="0"
              />
              <span className="text-xs text-slate-500">min</span>
            </div>
          </div>
        )}
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
