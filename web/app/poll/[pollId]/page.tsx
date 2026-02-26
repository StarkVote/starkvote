"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type AccountInterface } from "starknet";
import { connect, disconnect } from "starknetkit";

import {
  DEFAULT_POLL_ADDRESS,
  DEFAULT_REGISTRY_ADDRESS,
  DEFAULT_RPC_URL,
  createPollContract,
  createProvider,
  createRegistryContract,
  normalizeHex,
  toAddress,
  toBigIntValue,
  toBoolean,
  toU256,
} from "@/lib/starkvote";

import { CARD_CLASS } from "@/features/poll-admin/constants";
import { NoticeToast } from "@/features/poll-admin/components/notice-banner";
import type { Notice } from "@/features/poll-admin/types";
import { parseContractOptionLabels } from "@/features/poll-admin/utils";
import { generateProofClientSide } from "@/lib/client/proof-generation";

import { generateIdentityData, toIdentityJson } from "./_lib/identity";
import { resolveIdentitySerialized } from "./_lib/proof";
import { usePollVoterData, usePollVoterActions } from "./_lib/store";
import type { PollDetails } from "./_lib/types";
import {
  errorMessage,
  formatShortHash,
  getTxHash,
  parsePollDetails,
  parseU64,
} from "./_lib/utils";

import { StepConnect } from "./_components/step-connect";
import { StepRegister } from "./_components/step-register";
import { StepVote } from "./_components/step-vote";
import { StepResults } from "./_components/step-results";

const VOTER_STEPS = [
  { id: 1, label: "Connect Wallet" },
  { id: 2, label: "Register" },
  { id: 3, label: "Vote" },
  { id: 4, label: "Results" },
] as const;

function StepDots({
  current,
  total,
  maxUnlocked,
  onNavigate,
}: {
  current: number;
  total: number;
  maxUnlocked: number;
  onNavigate: (step: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2 pt-6">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const unlocked = step <= maxUnlocked;
        return (
          <button
            key={i}
            type="button"
            onClick={() => unlocked && onNavigate(step)}
            className={`h-1.5 rounded-full transition-all duration-300 ${step === current
                ? "w-6 bg-violet-500"
                : step < current
                  ? "w-1.5 bg-violet-500/40"
                  : "w-1.5 bg-white/[0.1]"
              } ${unlocked ? "cursor-pointer" : "cursor-default"}`}
          />
        );
      })}
    </div>
  );
}

function getMaxVoterStep(
  isConnected: boolean,
  alreadyRegistered: boolean | null,
  registerTx: string | null,
  pollData: PollDetails | null,
  voteTx: string | null,
): number {
  if (!isConnected) return 1;
  const registrationCompleted =
    alreadyRegistered === true || Boolean(registerTx);
  if (!registrationCompleted) return 2;
  if (!pollData?.exists) return 3;

  const now = Math.floor(Date.now() / 1000);
  const pollEnded = pollData.endTime > 0 && now > pollData.endTime;
  const hasVoted = Boolean(voteTx);

  // Keep users on Vote while the poll is live; unlock Results after vote/end/finalization.
  return hasVoted || pollEnded || pollData.finalized ? 4 : 3;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function PollPage() {
  const params = useParams<{ pollId: string | string[] }>();

  /* ---- Derived poll ID ---- */

  const pollIdParam = useMemo(() => {
    const value = params.pollId;
    return (Array.isArray(value) ? value[0] : value) ?? "";
  }, [params.pollId]);

  const pollIdValidation = useMemo(() => {
    try {
      const parsed = parseU64(pollIdParam, "Poll ID");
      return { value: parsed, error: null as string | null };
    } catch (error) {
      return { value: null, error: errorMessage(error) };
    }
  }, [pollIdParam]);

  const pollIdForCall = useMemo(
    () => (pollIdValidation.value ? pollIdValidation.value.toString() : null),
    [pollIdValidation.value],
  );

  /* ---- Persisted voter state (Zustand + localStorage) ---- */

  const {
    currentStep,
    selectedOption,
    identityInput,
    generatedIdentity,
    registerTx,
    voteTx,
  } = usePollVoterData(pollIdParam);

  const actions = usePollVoterActions(pollIdParam);

  /* ---- Transient local state ---- */

  const [optionLabels, setOptionLabels] = useState<string[]>([]);
  const [voteProgress, setVoteProgress] = useState<string | null>(null);
  const [generatedProofDisplay, setGeneratedProofDisplay] = useState<
    string | null
  >(null);

  /* Wallet */
  const [walletAccount, setWalletAccount] =
    useState<AccountInterface | null>(null);
  const [walletName, setWalletName] = useState("-");

  /* On-chain */
  const [pollData, setPollData] = useState<PollDetails | null>(null);
  const [tallies, setTallies] = useState<number[]>([]);
  const [resolvedRegistryAddress, setResolvedRegistryAddress] = useState(
    DEFAULT_REGISTRY_ADDRESS,
  );
  const [eligibleForPoll, setEligibleForPoll] = useState<boolean | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState<boolean | null>(
    null,
  );

  /* Loading / busy */
  const [loadingState, setLoadingState] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [voting, setVoting] = useState(false);

  /* Notice */
  const [notice, setNotice] = useState<Notice | null>(null);

  /* ---- Derived ---- */

  const provider = useMemo(() => createProvider(DEFAULT_RPC_URL), []);
  const accountAddress = walletAccount
    ? normalizeHex(walletAccount.address)
    : null;
  const isConnected = Boolean(walletAccount);

  /* ---- Wizard navigation ---- */

  const maxStep = getMaxVoterStep(
    isConnected,
    alreadyRegistered,
    registerTx,
    pollData,
    voteTx,
  );

  // Auto-advance: when maxStep increases (e.g. wallet connects, user
  // registers), advance to the next logical step — but never go *below* the
  // persisted currentStep so returning visitors stay where they left off.
  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;

  const prevMaxRef = useRef(1);
  useEffect(() => {
    if (maxStep > prevMaxRef.current) {
      if (maxStep > currentStepRef.current) {
        actions.setCurrentStep(maxStep);
      }
    }
    prevMaxRef.current = maxStep;
  }, [maxStep, actions]);

  useEffect(() => {
    if (currentStep > maxStep) {
      actions.setCurrentStep(maxStep);
    }
  }, [currentStep, maxStep, actions]);

  const goToStep = useCallback(
    (step: number) =>
      actions.setCurrentStep(Math.max(1, Math.min(step, maxStep))),
    [maxStep, actions],
  );

  const stepLabel = VOTER_STEPS[currentStep - 1]?.label ?? "";

  /* ---- On-chain data loading ---- */

  const loadOnChainState = useCallback(async () => {
    if (!pollIdForCall) return;

    setLoadingState(true);

    try {
      const pollRead = createPollContract(DEFAULT_POLL_ADDRESS, provider);
      const rawPoll = await pollRead.get_poll(pollIdForCall);
      const nextPollData = parsePollDetails(rawPoll);
      setPollData(nextPollData);

      let registryAddress = DEFAULT_REGISTRY_ADDRESS;
      try {
        const linkedRegistry = await pollRead.get_registry();
        registryAddress = toAddress(linkedRegistry);
      } catch {
        registryAddress = DEFAULT_REGISTRY_ADDRESS;
      }
      setResolvedRegistryAddress(registryAddress);

      const registryRead = createRegistryContract(registryAddress, provider);
      const frozen = await registryRead.is_frozen(pollIdForCall);
      void frozen; // consumed indirectly via eligibility

      if (accountAddress) {
        const [eligible, registered] = await Promise.all([
          registryRead.is_eligible(pollIdForCall, accountAddress),
          registryRead.has_registered(pollIdForCall, accountAddress),
        ]);
        setEligibleForPoll(toBoolean(eligible));
        setAlreadyRegistered(toBoolean(registered));
      } else {
        setEligibleForPoll(null);
        setAlreadyRegistered(null);
      }

      let nextLabels: string[] = [];
      try {
        const labelsResult = await pollRead.get_option_labels(pollIdForCall);
        nextLabels = parseContractOptionLabels(labelsResult);
      } catch {
        // Legacy polls may not expose option labels.
      }
      setOptionLabels(nextLabels);

      if (nextPollData.exists && nextPollData.optionsCount > 0) {
        const boundedOptions = Math.min(nextPollData.optionsCount, 64);
        const tallyCalls = Array.from({ length: boundedOptions }, (_, option) =>
          pollRead.get_tally(pollIdForCall, option),
        );
        const tallyRaw = await Promise.all(tallyCalls);
        setTallies(tallyRaw.map((value) => Number(toBigIntValue(value))));
      } else {
        setTallies([]);
      }
    } catch (error) {
      setNotice({ type: "error", message: errorMessage(error) });
    } finally {
      setLoadingState(false);
    }
  }, [accountAddress, pollIdForCall, provider]);

  /* ---- Wallet ---- */

  const connectWallet = useCallback(async () => {
    setConnectingWallet(true);
    setNotice(null);

    try {
      const result = await connect({
        modalMode: "alwaysAsk",
        modalTheme: "dark",
        dappName: "StarkVote",
      });
      if (!result.connector) {
        throw new Error("Wallet connection was cancelled.");
      }
      const nextAccount = await result.connector.account(provider);
      setWalletAccount(nextAccount);
      setWalletName(result.connector.name || "Wallet");
    } catch (error) {
      setNotice({ type: "error", message: errorMessage(error) });
    } finally {
      setConnectingWallet(false);
    }
  }, [provider]);

  const disconnectWallet = useCallback(async () => {
    try {
      await disconnect({ clearLastWallet: true });
    } catch {
      // Ignore wallet disconnect errors and still clear local state.
    }
    setWalletAccount(null);
    setWalletName("-");
    actions.setCurrentStep(1);
  }, [actions]);

  useEffect(() => {
    let ignore = false;
    const reconnectSilently = async () => {
      try {
        const result = await connect({
          modalMode: "neverAsk",
          modalTheme: "dark",
          dappName: "StarkVote",
        });
        if (!result.connector || ignore) return;
        const nextAccount = await result.connector.account(provider);
        if (ignore) return;
        setWalletAccount(nextAccount);
        setWalletName(result.connector.name || "Wallet");
      } catch {
        // No prior session is expected for first-time users.
      }
    };
    void reconnectSilently();
    return () => {
      ignore = true;
    };
  }, [provider]);

  /* ---- Register ---- */

  const handleRegister = useCallback(async () => {
    if (!walletAccount) {
      setNotice({
        type: "error",
        message: "Connect your wallet before registering.",
      });
      return;
    }
    if (!pollIdForCall) {
      setNotice({ type: "error", message: "Invalid poll ID." });
      return;
    }

    setRegistering(true);
    setNotice(null);
    actions.setRegisterTx(null);

    try {
      // Silently generate identity if not already generated
      let identity = generatedIdentity;
      if (!identity) {
        identity = generateIdentityData();
        actions.setGeneratedIdentity(identity);
        actions.setIdentityInput(identity.serialized);
      }

      const commitment = toBigIntValue(identity.commitment);
      const registryWrite = createRegistryContract(
        resolvedRegistryAddress,
        walletAccount,
      );
      const tx = await registryWrite.register_commitment(
        pollIdForCall,
        toU256(commitment),
      );
      const txHash = getTxHash(tx);
      actions.setRegisterTx(txHash);
      await provider.waitForTransaction(txHash);
      await loadOnChainState();
      setNotice({
        type: "success",
        message: "Commitment registered successfully.",
      });
    } catch (error) {
      setNotice({ type: "error", message: errorMessage(error) });
    } finally {
      setRegistering(false);
    }
  }, [
    actions,
    generatedIdentity,
    loadOnChainState,
    pollIdForCall,
    provider,
    resolvedRegistryAddress,
    walletAccount,
  ]);

  const handleDownloadIdentity = useCallback(() => {
    if (!generatedIdentity) return;

    const filenamePoll = pollIdParam.trim() || "poll";
    const payload = toIdentityJson(generatedIdentity);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `identity-${filenamePoll}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [generatedIdentity, pollIdParam]);

  /* ---- Vote ---- */

  const handleVote = useCallback(async () => {
    if (!walletAccount) {
      setNotice({
        type: "error",
        message: "Connect your wallet before voting.",
      });
      return;
    }
    if (!pollIdForCall || !pollIdValidation.value) {
      setNotice({ type: "error", message: "Invalid poll ID." });
      return;
    }
    if (selectedOption === null) {
      setNotice({ type: "error", message: "Select an option to vote for." });
      return;
    }
    if (pollData?.exists && selectedOption >= pollData.optionsCount) {
      setNotice({
        type: "error",
        message: `Option out of range. Poll supports options 0\u2013${Math.max(
          pollData.optionsCount - 1,
          0,
        )}.`,
      });
      return;
    }

    setVoting(true);
    setNotice(null);
    actions.setVoteTx(null);
    setGeneratedProofDisplay(null);

    try {
      let identitySerialized: string;
      if (identityInput.trim()) {
        identitySerialized = resolveIdentitySerialized(identityInput);
      } else if (generatedIdentity) {
        identitySerialized = generatedIdentity.serialized;
      } else {
        throw new Error(
          "Paste your serialized identity or identity.json content to generate proof.",
        );
      }

      setVoteProgress("Starting proof generation\u2026");
      const proofPayload = await generateProofClientSide({
        pollId: pollIdValidation.value,
        option: selectedOption,
        identitySerialized,
        onProgress: setVoteProgress,
      });

      setGeneratedProofDisplay(
        JSON.stringify(
          {
            poll_id: proofPayload.poll_id,
            option: proofPayload.option,
            leaf_index: proofPayload.leaf_index,
            leaf_count: proofPayload.leaf_count,
            full_proof_with_hints: proofPayload.full_proof_with_hints,
          },
          null,
          2,
        ),
      );

      setVoteProgress(
        `Proof ready (leaf ${proofPayload.leaf_index} of ${proofPayload.leaf_count}). Submitting vote\u2026`,
      );
      const pollWrite = createPollContract(DEFAULT_POLL_ADDRESS, walletAccount);
      const tx = await pollWrite.vote(
        pollIdForCall,
        selectedOption,
        proofPayload.full_proof_with_hints,
      );
      const txHash = getTxHash(tx);
      actions.setVoteTx(txHash);

      setVoteProgress("Waiting for confirmation\u2026");
      await provider.waitForTransaction(txHash);
      await loadOnChainState();
      actions.setCurrentStep(4);
      setNotice({ type: "success", message: "Vote submitted successfully." });
    } catch (error) {
      setNotice({ type: "error", message: errorMessage(error) });
    } finally {
      setVoting(false);
      setVoteProgress(null);
    }
  }, [
    actions,
    walletAccount,
    pollIdForCall,
    pollIdValidation.value,
    selectedOption,
    pollData,
    identityInput,
    generatedIdentity,
    provider,
    loadOnChainState,
  ]);

  /* ---- Effects ---- */

  useEffect(() => {
    if (!pollIdForCall) return;
    void loadOnChainState();
    const interval = setInterval(() => {
      void loadOnChainState();
    }, 15_000);
    return () => clearInterval(interval);
  }, [loadOnChainState, pollIdForCall]);

  useEffect(() => {
    if (pollIdValidation.error) {
      setNotice({ type: "error", message: pollIdValidation.error });
    }
  }, [pollIdValidation.error]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  /* ---- Render ---- */

  return (
    <div className="min-h-screen bg-[#0a0a0f] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,80,200,0.15),transparent)]">
      <main className="mx-auto flex min-h-screen max-w-lg flex-col px-6 py-12">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-400/70">
              StarkVote
            </p>
            <h1 className="text-lg font-semibold text-white">
              Poll {pollIdParam}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {isConnected ? (
              <button
                type="button"
                onClick={() => void disconnectWallet()}
                className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-slate-400 transition hover:text-white"
              >
                {formatShortHash(accountAddress)} &times;
              </button>
            ) : null}
            <Link
              href="/"
              className="text-xs text-slate-500 transition hover:text-white"
            >
              &larr; Back
            </Link>
          </div>
        </header>

        <NoticeToast notice={notice} onDismiss={dismissNotice} />

        {/* Wizard card */}
        <div className="flex flex-1 flex-col justify-center">
          <section className={CARD_CLASS}>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
                {stepLabel}
              </p>
              <p className="text-xs tabular-nums text-slate-600">
                #{pollIdParam}
              </p>
            </div>

            {currentStep === 1 ? (
              <StepConnect
                isConnected={isConnected}
                walletName={walletName}
                accountAddress={accountAddress}
                connecting={connectingWallet}
                onConnect={() => void connectWallet()}
                onContinue={() => goToStep(2)}
              />
            ) : null}

            {currentStep === 2 ? (
              <StepRegister
                isConnected={isConnected}
                connecting={connectingWallet}
                eligibleForPoll={eligibleForPoll}
                alreadyRegistered={alreadyRegistered}
                onConnect={() => void connectWallet()}
                onRegister={() => void handleRegister()}
                onDownloadIdentity={handleDownloadIdentity}
                registering={registering}
                registerTx={registerTx}
                generatedIdentity={generatedIdentity}
              />
            ) : null}

            {currentStep === 3 ? (
              <StepVote
                isConnected={isConnected}
                connecting={connectingWallet}
                sameAccountAsRegistrant={alreadyRegistered === true}
                pollData={pollData}
                optionLabels={optionLabels}
                selectedOption={selectedOption}
                onConnect={() => void connectWallet()}
                onOptionSelect={actions.setSelectedOption}
                identityInput={identityInput}
                onIdentityInputChange={actions.setIdentityInput}
                hasSessionIdentity={Boolean(generatedIdentity)}
                onVote={() => void handleVote()}
                voting={voting}
                voteProgress={voteProgress}
                voteTx={voteTx}
                generatedProofDisplay={generatedProofDisplay}
              />
            ) : null}

            {currentStep === 4 ? (
              <StepResults
                isConnected={isConnected}
                connecting={connectingWallet}
                pollData={pollData}
                tallies={tallies}
                optionLabels={optionLabels}
                pollAddress={DEFAULT_POLL_ADDRESS}
                registryAddress={resolvedRegistryAddress}
                loading={loadingState}
                onConnect={() => void connectWallet()}
                onRefresh={() => void loadOnChainState()}
              />
            ) : null}

            <StepDots
              current={currentStep}
              total={4}
              maxUnlocked={maxStep}
              onNavigate={goToStep}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
