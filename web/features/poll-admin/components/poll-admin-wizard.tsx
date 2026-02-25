"use client";

import { useEffect } from "react";

import { CARD_CLASS } from "../constants";
import { usePollAdminWizard } from "../hooks/use-poll-admin-wizard";
import { NoticeBanner } from "./notice-banner";
import { StepAddEligible } from "./steps/step-add-eligible";
import { StepConnectWallet } from "./steps/step-connect-wallet";
import { StepCreatePoll } from "./steps/step-create-poll";
import { StepFreezeRegistry } from "./steps/step-freeze-registry";
import { StepManagePoll } from "./steps/step-manage-poll";
import { WizardHeader } from "./wizard-header";
import { WizardNavigation } from "./wizard-navigation";
import { WizardStepper } from "./wizard-stepper";
import { WizardSummary } from "./wizard-summary";

export function PollAdminWizard() {
  const wizard = usePollAdminWizard();

  useEffect(() => {
    if (wizard.currentStep !== 5) return;
    const interval = setInterval(() => {
      void wizard.refreshStatus(false);
    }, 10_000);
    return () => clearInterval(interval);
  }, [wizard.currentStep, wizard.refreshStatus]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_0%_0%,#f2f5ff_0,#f8fafc_35%,#f7f7f8_100%)]">
      <main className="mx-auto max-w-7xl px-6 py-12">
        <WizardHeader
          lifecycle={wizard.lifecycle}
          isBusy={wizard.isBusy}
          onRefresh={() => void wizard.refreshStatus(true)}
        />

        <NoticeBanner notice={wizard.notice} />

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className={CARD_CLASS}>
            <WizardStepper
              steps={wizard.steps}
              currentStep={wizard.currentStep}
              maxUnlockedStep={wizard.maxUnlockedStep}
              onStepClick={wizard.goToStep}
            />

            {wizard.currentStep === 1 ? (
              <StepConnectWallet
                rpcUrl={wizard.rpcUrl}
                pollAddress={wizard.pollAddress}
                registryAddress={wizard.registryAddress}
                pollIdInput={wizard.pollIdInput}
                isWalletConnected={wizard.isWalletConnected}
                walletAddress={wizard.walletAddress}
                walletChainId={wizard.walletChainId}
                isBusy={wizard.isBusy}
                onRpcUrlChange={wizard.setRpcUrl}
                onPollAddressChange={wizard.setPollAddress}
                onRegistryAddressChange={wizard.setRegistryAddress}
                onPollIdChange={wizard.setPollIdInput}
                onConnect={wizard.connectWallet}
                onDisconnect={wizard.disconnectWallet}
              />
            ) : null}

            {wizard.currentStep === 2 ? (
              <StepAddEligible
                eligibleInput={wizard.eligibleInput}
                pollIdInput={wizard.pollIdInput}
                leafCount={wizard.status?.leafCount ?? 0}
                isFrozen={Boolean(wizard.status?.frozen)}
                busyAction={wizard.busyAction}
                isBusy={wizard.isBusy}
                isWalletConnected={wizard.isWalletConnected}
                onEligibleInputChange={wizard.setEligibleInput}
                onAddEligibleBatch={wizard.addEligibleBatch}
              />
            ) : null}

            {wizard.currentStep === 3 ? (
              <StepFreezeRegistry
                isFrozen={Boolean(wizard.status?.frozen)}
                busyAction={wizard.busyAction}
                isBusy={wizard.isBusy}
                isWalletConnected={wizard.isWalletConnected}
                onFreezeRegistry={wizard.freezeRegistry}
              />
            ) : null}

            {wizard.currentStep === 4 ? (
              <StepCreatePoll
                optionsCountInput={wizard.optionsCountInput}
                durationInput={wizard.durationInput}
                merkleRootInput={wizard.merkleRootInput}
                optionLabelsInput={wizard.optionLabelsInput}
                busyAction={wizard.busyAction}
                isBusy={wizard.isBusy}
                isComputingRoot={wizard.isComputingRoot}
                isWalletConnected={wizard.isWalletConnected}
                onOptionsCountChange={wizard.setOptionsCountInput}
                onDurationChange={wizard.setDurationInput}
                onMerkleRootChange={wizard.setMerkleRootInput}
                onOptionLabelsChange={wizard.setOptionLabelsInput}
                onCreatePoll={wizard.createPoll}
                onComputeSnapshotRoot={wizard.computeSnapshotRoot}
              />
            ) : null}

            {wizard.currentStep === 5 ? (
              <StepManagePoll
                tallies={wizard.status?.tallies ?? []}
                optionLabels={wizard.status?.optionLabels ?? []}
                hasPoll={Boolean(wizard.status?.exists)}
                endTime={wizard.status?.endTime ?? 0}
                finalized={wizard.status?.finalized ?? false}
                busyAction={wizard.busyAction}
                isBusy={wizard.isBusy}
                isWalletConnected={wizard.isWalletConnected}
                onFinalizePoll={wizard.finalizePoll}
              />
            ) : null}

            <WizardNavigation
              canGoPrevious={wizard.canGoPrevious}
              canGoNext={wizard.canGoNext}
              currentHint={wizard.steps[wizard.currentStep - 1].hint}
              onPrevious={wizard.goPreviousStep}
              onNext={wizard.goNextStep}
            />
          </section>

          <WizardSummary
            pollIdInput={wizard.pollIdInput}
            status={wizard.status}
            isWalletConnected={wizard.isWalletConnected}
            isPollAdmin={wizard.isPollAdmin}
            lastTxHash={wizard.lastTxHash}
          />
        </div>
      </main>
    </div>
  );
}
