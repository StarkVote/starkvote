import type { PollDetails } from "../_lib/types";

type VoteCardProps = {
  pollData: PollDetails | null;
  optionLabels: string[];
  selectedOption: number | null;
  onOptionSelect: (option: number) => void;
  identityInput: string;
  onIdentityInputChange: (value: string) => void;
  hasSessionIdentity: boolean;
  onVote: () => void;
  voting: boolean;
  voteProgress: string | null;
  disabled: boolean;
  voteTx: string | null;
  generatedProofDisplay: string | null;
};

export function VoteCard({
  pollData,
  optionLabels,
  selectedOption,
  onOptionSelect,
  identityInput,
  onIdentityInputChange,
  hasSessionIdentity,
  onVote,
  voting,
  voteProgress,
  disabled,
  voteTx,
  generatedProofDisplay,
}: VoteCardProps) {
  const optionCount = pollData?.optionsCount ?? 0;
  const options = Array.from({ length: optionCount }, (_, i) => i);
  const canVote =
    selectedOption !== null &&
    (identityInput.trim().length > 0 || hasSessionIdentity) &&
    !voting;

  return (
    <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
      <h2 className="text-lg font-semibold">Cast your vote</h2>
      <p className="mt-1 text-sm text-slate-400">
        Select an option, paste your identity, and vote. The proof is generated
        automatically.
      </p>

      <div className="mt-4">
        <p className="text-sm font-medium text-slate-300">1. Select option</p>
        {pollData === null ? (
          <p className="mt-2 text-sm text-slate-400">Loading poll data...</p>
        ) : optionCount > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {options.map((option) => {
              const label = optionLabels[option] || `Option ${option}`;
              const isSelected = selectedOption === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onOptionSelect(option)}
                  disabled={voting}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                    isSelected
                      ? "border-amber-400 bg-amber-400/20 text-amber-100"
                      : "border-slate-600 bg-slate-950/70 text-slate-300 hover:border-slate-400 hover:text-slate-100"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-400">This poll has no options.</p>
        )}
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-slate-300">2. Paste identity</p>
        {hasSessionIdentity && !identityInput.trim() ? (
          <p className="mt-1 text-xs text-emerald-300">
            Using identity generated in this session. You can also paste a
            different one below.
          </p>
        ) : null}
        <textarea
          id="identity-paste"
          value={identityInput}
          onChange={(e) => onIdentityInputChange(e.target.value)}
          rows={2}
          placeholder="Paste serialized identity string or full identity.json content"
          disabled={voting}
          className="mt-1.5 w-full rounded-xl border border-slate-600 bg-slate-950/70 px-3 py-2 font-mono text-xs outline-none ring-sky-300 transition focus:ring disabled:opacity-60"
        />
      </div>

      <button
        type="button"
        onClick={onVote}
        disabled={!canVote}
        className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-amber-300 text-sm font-semibold text-amber-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {voting ? (voteProgress ?? "Processing...") : "Vote"}
      </button>

      {generatedProofDisplay ? (
        <details className="mt-3 rounded-xl border border-slate-700/80 bg-slate-950/50 p-3">
          <summary className="cursor-pointer text-xs text-slate-400">
            View generated proof
          </summary>
          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] text-slate-400">
            {generatedProofDisplay}
          </pre>
        </details>
      ) : null}

      {voteTx ? (
        <p className="mt-3 text-xs text-amber-100">
          Vote tx: <span className="font-mono">{voteTx}</span>
        </p>
      ) : null}
    </article>
  );
}
