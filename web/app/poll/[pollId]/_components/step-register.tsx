import { useCallback, useRef, useState, useEffect } from "react";

import { PRIMARY_BUTTON_CLASS } from "@/features/poll-admin/constants";

import type { GeneratedIdentity } from "../_lib/types";

type StepRegisterProps = {
  isConnected: boolean;
  connecting: boolean;
  eligibleForPoll: boolean | null;
  alreadyRegistered: boolean | null;
  onConnect: () => void;
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
  isConnected,
  connecting,
  eligibleForPoll,
  alreadyRegistered,
  onConnect,
  onRegister,
  onDownloadIdentity,
  registering,
  registerTx,
  generatedIdentity,
}: StepRegisterProps) {
  const registrationCompleted = alreadyRegistered === true || Boolean(registerTx);
  const showIdentityActions = Boolean(registerTx && generatedIdentity);

  if (registrationCompleted) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-950/30 px-4 py-3">
          <p className="text-sm text-emerald-300">
            Your commitment is registered for this poll.
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

  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="space-y-5">
      {eligibleForPoll === false && !registrationCompleted ? (
        <div className="rounded-lg border border-red-500/20 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          Your address is not whitelisted for this poll.
        </div>
      ) : null}

      <div className="space-y-2">
        {/* Short tagline + expandable details */}
        <div className="text-left">
          <p className="text-sm text-slate-300">
            Register to cast an anonymous vote
          </p>
        </div>

        {/* Collapsible "How it works" */}
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="flex w-full items-center justify-left gap-1.5 text-xs text-slate-500 transition hover:text-slate-300 cursor-pointer"
        >
          How it works
          <svg
            className={`h-3 w-3 transition-transform duration-200 ${showDetails ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div
          className={`grid transition-all duration-300 ease-in-out ${showDetails ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        >
          <div className="overflow-hidden">
            <div className="space-y-2 pb-1">
              {[
                { n: "1", title: "Generate secret identity", desc: "Created locally in your browser" },
                { n: "2", title: "Register commitment on-chain", desc: "Only a hash is sent — identity stays private" },
                { n: "3", title: "Ready to vote", desc: "Cast an anonymous vote via zero-knowledge proof" },
              ].map((s) => (
                <div key={s.n} className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#633CFF]/15 text-[10px] font-semibold text-[#a78bfa]">{s.n}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-300">{s.title}</p>
                    <p className="text-[11px] text-slate-500">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>




      <button
        type="button"
        onClick={isConnected ? onRegister : onConnect}
        disabled={
          isConnected
            ? registering || eligibleForPoll === false
            : connecting
        }
        className={`${PRIMARY_BUTTON_CLASS} w-full`}
      >
        {isConnected
          ? registering
            ? "Registering\u2026"
            : "Register"
          : connecting
            ? "Connecting\u2026"
            : "Connect Wallet"}
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
