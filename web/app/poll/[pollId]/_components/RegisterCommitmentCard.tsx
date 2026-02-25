import type { FormEvent } from "react";

import type { GeneratedIdentity } from "../_lib/types";

type RegisterCommitmentCardProps = {
  commitmentInput: string;
  onCommitmentChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onGenerateIdentity: () => void;
  onDownloadIdentity: () => void;
  registering: boolean;
  disabled: boolean;
  registerTx: string | null;
  generatedIdentity: GeneratedIdentity | null;
};

export function RegisterCommitmentCard({
  commitmentInput,
  onCommitmentChange,
  onSubmit,
  onGenerateIdentity,
  onDownloadIdentity,
  registering,
  disabled,
  registerTx,
  generatedIdentity,
}: RegisterCommitmentCardProps) {
  return (
    <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
      <h2 className="text-lg font-semibold">Register commitment</h2>
      <p className="mt-1 text-sm text-slate-400">
        Generate a Semaphore identity, keep its secret private, then register its
        commitment (`u256`).
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onGenerateIdentity}
          className="inline-flex h-10 items-center justify-center rounded-full border border-sky-300/60 px-4 text-sm font-semibold text-sky-100 transition hover:border-sky-200"
        >
          Generate identity + commitment
        </button>
        {generatedIdentity ? (
          <button
            type="button"
            onClick={onDownloadIdentity}
            className="inline-flex h-10 items-center justify-center rounded-full border border-amber-300/70 px-4 text-sm font-semibold text-amber-100 transition hover:border-amber-200"
          >
            Download identity.json
          </button>
        ) : null}
      </div>
      {generatedIdentity ? (
        <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-950/40 p-3 text-xs text-amber-100">
          <p className="font-semibold">
            Important: Keep identity.json secret. Share only the commitment.
          </p>
          <p className="mt-1 break-all font-mono">
            secret_scalar: {generatedIdentity.secretScalar}
          </p>
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <label className="block text-sm text-slate-300" htmlFor="commitment">
          Commitment
        </label>
        <input
          id="commitment"
          value={commitmentInput}
          onChange={(event) => onCommitmentChange(event.target.value)}
          placeholder="e.g. 0x1234... or 123456..."
          className="w-full rounded-xl border border-slate-600 bg-slate-950/70 px-3 py-2 text-sm outline-none ring-sky-300 transition focus:ring"
        />
        <button
          type="submit"
          disabled={registering || disabled}
          className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-400 px-4 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {registering ? "Registering..." : "Register commitment"}
        </button>
      </form>
      {registerTx ? (
        <p className="mt-3 text-xs text-emerald-200">
          Registered: <span className="font-mono">{registerTx}</span>
        </p>
      ) : null}
    </article>
  );
}
