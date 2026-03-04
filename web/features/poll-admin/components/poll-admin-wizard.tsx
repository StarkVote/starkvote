"use client";

import { useEffect, useMemo, useState } from "react";

import { CARD_CLASS, WIZARD_STEPS } from "../constants";
import { usePollAdminWizard } from "../hooks/use-poll-admin-wizard";
import { NoticeToast } from "./notice-banner";
import { StepAddEligible } from "./steps/step-add-eligible";
import { StepConnectWallet } from "./steps/step-connect-wallet";
import { StepCreatePoll } from "./steps/step-create-poll";
import { StepManagePoll } from "./steps/step-manage-poll";
import { TopNav } from "@/components/top-nav";

const BUSY_LABELS: Record<string, string> = {
  add_eligible_batch: "Whitelisting voters on-chain…",
  freeze: "Freezing voter registry…",
  computing_root: "Computing snapshot root…",
  create_poll: "Opening the poll…",
  finalize: "Finalizing poll results…",
};

function BusyOverlay({ action }: { action: string }) {
  const label = BUSY_LABELS[action] || "Processing transaction…";
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-2xl bg-[#0a0a12]/80 backdrop-blur-sm">
      <svg
        className="h-8 w-8 animate-spin text-[#633CFF]"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        />
      </svg>
      <p className="text-base font-medium text-slate-200">{label}</p>
    </div>
  );
}

function NotAdminOverlay() {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-2xl bg-[#0a0a12]/90 backdrop-blur-md">
      <svg
        className="h-10 w-10 text-amber-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
        />
      </svg>
      <p className="max-w-xs text-center text-base font-medium text-slate-200">
        Your connected wallet is not the admin of this poll.
      </p>
      <p className="max-w-xs text-center text-sm text-slate-400">
        Please switch to the admin account in your wallet to manage this poll.
      </p>
    </div>
  );
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2.5 pt-8">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${i + 1 === current
              ? "w-8 bg-[#633CFF]"
              : i + 1 < current
                ? "w-2 bg-[#633CFF]/40"
                : "w-2 bg-white/[0.1]"
            }`}
        />
      ))}
    </div>
  );
}

export function PollAdminWizard({ pollId }: { pollId?: string } = {}) {
  const wizard = usePollAdminWizard(pollId);
  const [questionText, setQuestionText] = useState<string | null>(null);

  useEffect(() => {
    if (!pollId) return;
    let cancelled = false;
    fetch(`/api/questions?pollId=${pollId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.question) setQuestionText(data.question);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pollId]);

  const isFinalized = wizard.status?.finalized ?? false;

  // Show "not admin" overlay when on a URL-based poll page, wallet is connected,
  // status has been fetched (pollAdmin is known), and current wallet isn't the admin.
  const showNotAdminOverlay = useMemo(() => {
    if (!pollId || !wizard.isWalletConnected || !wizard.status) return false;
    // If pollAdmin is 0x0 it means no admin has been set yet (poll doesn't exist)
    if (!wizard.status.pollAdmin || wizard.status.pollAdmin === "0x0") return false;
    return !wizard.isPollAdmin;
  }, [pollId, wizard.isWalletConnected, wizard.status, wizard.isPollAdmin]);

  useEffect(() => {
    if (wizard.currentStep !== 4 || isFinalized) return;
    const interval = setInterval(() => {
      void wizard.refreshStatus(false);
    }, 1_000);
    return () => clearInterval(interval);
  }, [wizard.currentStep, isFinalized, wizard.refreshStatus]);

  const stepLabel = WIZARD_STEPS[wizard.currentStep - 1].label;

  const truncateAddr = (addr: string) =>
    addr.length <= 14 ? addr : `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="min-h-screen bg-[#0a0a12] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,60,255,0.12),transparent)]">
      <TopNav>
        {wizard.isWalletConnected && (
          <div className="flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.05] px-4 py-2 text-sm text-slate-300 backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {truncateAddr(wizard.walletAddress)}
            <button
              type="button"
              onClick={() => void wizard.disconnectWallet()}
              disabled={wizard.isBusy}
              className="ml-1 text-slate-500 transition hover:text-red-400 disabled:opacity-40"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        )}
      </TopNav>

      <main className="mx-auto flex min-h-[calc(100vh-80px)] max-w-2xl flex-col px-6 py-6">
        <NoticeToast notice={wizard.notice} onDismiss={wizard.clearNotice} />

        <div className="flex flex-1 flex-col justify-center">
          <section className={`${CARD_CLASS} relative overflow-hidden`}>
            {showNotAdminOverlay && <NotAdminOverlay />}
            {!showNotAdminOverlay && (wizard.isBusy || wizard.isComputingRoot) && (
              <BusyOverlay action={wizard.isComputingRoot && !wizard.busyAction ? "computing_root" : wizard.busyAction} />
            )}
            <div className="mb-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium uppercase tracking-widest text-slate-500">
                  {stepLabel}
                </p>
                {wizard.pollIdInput && (
                  <span className="text-xs tabular-nums text-slate-500">
                    Poll #{wizard.pollIdInput}
                  </span>
                )}
              </div>
              {questionText && (wizard.currentStep === 3 || wizard.currentStep === 4) && (
                <p className="mt-2 text-base font-medium text-slate-200">
                  {questionText}
                </p>
              )}
            </div>

            {wizard.currentStep === 1 ? (
              <StepConnectWallet
                isWalletConnected={wizard.isWalletConnected}
                walletAddress={wizard.walletAddress}
                isBusy={wizard.isBusy}
                onConnect={wizard.connectWallet}
                onDisconnect={wizard.disconnectWallet}
              />
            ) : null}

            {wizard.currentStep === 2 ? (
              <StepAddEligible
                eligibleInput={wizard.eligibleInput}
                eligibleAddresses={wizard.eligibleAddresses}
                registeredVoters={wizard.registeredVoters}
                walletAddress={wizard.walletAddress}
                pollId={wizard.pollIdInput}
                leafCount={wizard.status?.leafCount ?? 0}
                isFrozen={Boolean(wizard.status?.frozen)}
                busyAction={wizard.busyAction}
                isBusy={wizard.isBusy}
                isWalletConnected={wizard.isWalletConnected}
                onEligibleInputChange={wizard.setEligibleInput}
                onAddEligibleBatch={wizard.addEligibleBatch}
                onFreezeRegistry={wizard.freezeRegistry}
              />
            ) : null}

            {wizard.currentStep === 3 ? (
              <StepCreatePoll
                durationInput={wizard.durationInput}
                optionLabelsInput={wizard.optionLabelsInput}
                busyAction={wizard.busyAction}
                isBusy={wizard.isBusy}
                isComputingRoot={wizard.isComputingRoot}
                isWalletConnected={wizard.isWalletConnected}
                onDurationChange={wizard.setDurationInput}
                onOptionLabelsChange={wizard.setOptionLabelsInput}
                onCreatePoll={wizard.createPoll}
              />
            ) : null}

            {wizard.currentStep === 4 ? (
              <StepManagePoll
                tallies={wizard.status?.tallies ?? []}
                optionLabels={wizard.status?.optionLabels ?? []}
                hasPoll={Boolean(wizard.status?.exists)}
                endTime={wizard.status?.endTime ?? 0}
                finalized={wizard.status?.finalized ?? false}
                isDraw={wizard.status?.isDraw ?? false}
                winnerOption={wizard.status?.winnerOption ?? 0}
                busyAction={wizard.busyAction}
                isBusy={wizard.isBusy}
                isWalletConnected={wizard.isWalletConnected}
                pollId={wizard.pollIdInput}
                onFinalizePoll={wizard.finalizePoll}
                questionText={questionText}
              />
            ) : null}

            <StepDots current={wizard.currentStep} total={4} />
          </section>
        </div>
      </main>
    </div>
  );
}
