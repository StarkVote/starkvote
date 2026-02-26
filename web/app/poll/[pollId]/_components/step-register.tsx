import { useCallback, useRef, useState, useEffect } from "react";

import { PRIMARY_BUTTON_CLASS } from "@/features/poll-admin/constants";

import type { GeneratedIdentity } from "../_lib/types";

type StepRegisterProps = {
  eligibleForPoll: boolean | null;
  alreadyRegistered: boolean | null;
  onRegister: () => void;
  onDownloadIdentity: () => void;
  registering: boolean;
  registerTx: string | null;
  generatedIdentity: GeneratedIdentity | null;
};

function IdentityMenu({
  identity,
  onDownload,
}: {
  identity: GeneratedIdentity;
  onDownload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(identity.serialized).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 1200);
    });
  }, [identity.serialized]);

  const handleDownload = useCallback(() => {
    onDownload();
    setOpen(false);
  }, [onDownload]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-slate-500 transition hover:text-white"
      >
        Save identity &darr;
      </button>
      {open ? (
        <div className="absolute right-0 z-10 mt-1 min-w-[140px] rounded-lg border border-white/[0.08] bg-[#141419] p-1 shadow-xl">
          <button
            type="button"
            onClick={handleCopy}
            className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            Download
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function StepRegister({
  eligibleForPoll,
  alreadyRegistered,
  onRegister,
  onDownloadIdentity,
  registering,
  registerTx,
  generatedIdentity,
}: StepRegisterProps) {
  const showIdentityActions = Boolean(registerTx && generatedIdentity);

  if (alreadyRegistered === true) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-950/30 px-4 py-3">
          <p className="text-sm text-emerald-300">
            Your commitment is registered.
          </p>
          {generatedIdentity ? (
            <IdentityMenu
              identity={generatedIdentity}
              onDownload={onDownloadIdentity}
            />
          ) : null}
        </div>
        {generatedIdentity ? (
          <p className="text-xs text-slate-500">
            Your identity was generated this session. Use the menu above to save
            it before leaving.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {eligibleForPoll === false ? (
        <div className="rounded-lg border border-red-500/20 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          Your address is not whitelisted for this poll.
        </div>
      ) : null}

      <p className="text-sm text-slate-400">
        A Semaphore identity will be generated automatically and its commitment
        registered on-chain.
      </p>

      <button
        type="button"
        onClick={onRegister}
        disabled={registering || eligibleForPoll === false}
        className={`${PRIMARY_BUTTON_CLASS} w-full`}
      >
        {registering ? "Registering\u2026" : "Register"}
      </button>

      {showIdentityActions ? (
        <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-2.5">
          <p className="font-mono text-xs text-slate-500 truncate mr-3">
            {registerTx}
          </p>
          <IdentityMenu
            identity={generatedIdentity!}
            onDownload={onDownloadIdentity}
          />
        </div>
      ) : null}
    </div>
  );
}
