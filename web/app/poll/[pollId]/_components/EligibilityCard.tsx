type EligibilityCardProps = {
  eligibleForPoll: boolean | null;
  alreadyRegistered: boolean | null;
};

export function EligibilityCard({
  eligibleForPoll,
  alreadyRegistered,
}: EligibilityCardProps) {
  return (
    <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
      <h2 className="text-sm uppercase tracking-[0.2em] text-slate-300">Your Eligibility</h2>
      <p className="mt-3 text-sm">
        Eligible:{" "}
        <span className="font-semibold text-slate-100">
          {eligibleForPoll === null ? "Connect wallet" : eligibleForPoll ? "Yes" : "No"}
        </span>
      </p>
      <p className="mt-1 text-sm">
        Registered commitment:{" "}
        <span className="font-semibold text-slate-100">
          {alreadyRegistered === null
            ? "Connect wallet"
            : alreadyRegistered
              ? "Yes"
              : "No"}
        </span>
      </p>
      <p className="mt-3 text-xs text-slate-400">
        Registration requires your address to be whitelisted in registry for this poll
        ID.
      </p>
    </article>
  );
}
