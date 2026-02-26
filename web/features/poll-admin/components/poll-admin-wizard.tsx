"use client";

import { useEffect } from "react";

import { CARD_CLASS, WIZARD_STEPS } from "../constants";
import { usePollAdminWizard } from "../hooks/use-poll-admin-wizard";
import { useActivePollKey } from "../store";
import { NoticeToast } from "./notice-banner";
import { StepAddEligible } from "./steps/step-add-eligible";
import { StepConnectWallet } from "./steps/step-connect-wallet";
import { StepCreatePoll } from "./steps/step-create-poll";
import { StepManagePoll } from "./steps/step-manage-poll";
import { PollSwitcher } from "./poll-list";
import { WizardHeader } from "./wizard-header";

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 pt-6">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${i + 1 === current
              ? "w-6 bg-violet-500"
              : i + 1 < current
                ? "w-1.5 bg-violet-500/40"
                : "w-1.5 bg-white/[0.1]"
            }`}
        />
      ))}
    </div>
  );
}

export function PollAdminWizard() {
  const wizard = usePollAdminWizard();
  const activePollKey = useActivePollKey();

  const isFinalized = wizard.status?.finalized ?? false;

  useEffect(() => {
    if (wizard.currentStep !== 4 || isFinalized) return;
    const interval = setInterval(() => {
      void wizard.refreshStatus(false);
    }, 1_000);
    return () => clearInterval(interval);
  }, [wizard.currentStep, isFinalized, wizard.refreshStatus]);

  const stepLabel = WIZARD_STEPS[wizard.currentStep - 1].label;

  return (
    <div className="min-h-screen bg-[#0a0a0f] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,80,200,0.15),transparent)]">
      <main className="mx-auto flex min-h-screen max-w-lg flex-col px-6 py-12">
        <WizardHeader
          isWalletConnected={wizard.isWalletConnected}
          walletAddress={wizard.walletAddress}
          isBusy={wizard.isBusy}
          onDisconnect={wizard.disconnectWallet}
        />

        <NoticeToast notice={wizard.notice} onDismiss={wizard.clearNotice} />

        <div className="flex flex-1 flex-col justify-center">
          <section className={CARD_CLASS}>
            <div className="mb-4 flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
                {stepLabel}
              </p>
              <div className="flex items-center gap-2">
                <PollSwitcher
                  currentWallet={wizard.walletAddress}
                  isWalletConnected={wizard.isWalletConnected}
                  activePollKey={activePollKey}
                  pollIdInput={wizard.pollIdInput}
                  onNavigate={wizard.goToStep}
                  onStartNewPoll={wizard.startNewPoll}
                />
              </div>
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
              />
            ) : null}

            <StepDots current={wizard.currentStep} total={4} />
          </section>
        </div>
      </main>
    </div>
  );
}
