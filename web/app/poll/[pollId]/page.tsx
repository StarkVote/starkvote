"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { byteArray, type AccountInterface, type ByteArray } from "starknet";
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

import { EligibilityCard } from "./_components/EligibilityCard";
import { ErrorAlert } from "./_components/ErrorAlert";
import { PageHeader } from "./_components/PageHeader";
import { PollDetailsCard } from "./_components/PollDetailsCard";
import { PollStatusCard } from "./_components/PollStatusCard";
import { RegisterCommitmentCard } from "./_components/RegisterCommitmentCard";
import { VoteCard } from "./_components/VoteCard";
import { WalletCard } from "./_components/WalletCard";
import { generateProofClientSide } from "@/lib/client/proof-generation";

import { generateIdentityData, toIdentityJson } from "./_lib/identity";
import { resolveIdentitySerialized } from "./_lib/proof";
import type { GeneratedIdentity, PollDetails } from "./_lib/types";
import {
  errorMessage,
  getTxHash,
  parsePollDetails,
  parseU64,
} from "./_lib/utils";

function decodeByteArrayValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    try {
      return byteArray.stringFromByteArray(value as ByteArray);
    } catch {
      // Fall through to string cast.
    }
  }
  return String(value ?? "");
}

export default function PollPage() {
  const params = useParams<{ pollId: string | string[] }>();

  const [commitmentInput, setCommitmentInput] = useState("");
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [optionLabels, setOptionLabels] = useState<string[]>([]);
  const [identityInput, setIdentityInput] = useState("");
  const [voteProgress, setVoteProgress] = useState<string | null>(null);
  const [generatedProofDisplay, setGeneratedProofDisplay] = useState<string | null>(
    null,
  );

  const [walletAccount, setWalletAccount] = useState<AccountInterface | null>(null);
  const [walletName, setWalletName] = useState("-");

  const [pollData, setPollData] = useState<PollDetails | null>(null);
  const [tallies, setTallies] = useState<number[]>([]);
  const [resolvedRegistryAddress, setResolvedRegistryAddress] =
    useState(DEFAULT_REGISTRY_ADDRESS);

  const [registryFrozen, setRegistryFrozen] = useState<boolean | null>(null);
  const [eligibleForPoll, setEligibleForPoll] = useState<boolean | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState<boolean | null>(null);

  const [loadingState, setLoadingState] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [voting, setVoting] = useState(false);

  const [registerTx, setRegisterTx] = useState<string | null>(null);
  const [voteTx, setVoteTx] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [generatedIdentity, setGeneratedIdentity] =
    useState<GeneratedIdentity | null>(null);

  const pollIdParam = useMemo(() => {
    const value = params.pollId;
    if (Array.isArray(value)) {
      return value[0] ?? "";
    }
    return value ?? "";
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

  const provider = useMemo(() => createProvider(DEFAULT_RPC_URL), []);
  const accountAddress = walletAccount ? normalizeHex(walletAccount.address) : null;

  const loadOnChainState = useCallback(async () => {
    if (!pollIdForCall) {
      return;
    }

    setLoadingState(true);
    setLastError(null);

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
      setRegistryFrozen(toBoolean(frozen));

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
        if (Array.isArray(labelsResult)) {
          nextLabels = labelsResult.map(decodeByteArrayValue);
        }
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
      setLastError(errorMessage(error));
    } finally {
      setLoadingState(false);
    }
  }, [accountAddress, pollIdForCall, provider]);

  const connectWallet = useCallback(async () => {
    setConnectingWallet(true);
    setLastError(null);

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
      setLastError(errorMessage(error));
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
  }, []);

  useEffect(() => {
    let ignore = false;

    const reconnectSilently = async () => {
      try {
        const result = await connect({
          modalMode: "neverAsk",
          modalTheme: "dark",
          dappName: "StarkVote",
        });
        if (!result.connector || ignore) {
          return;
        }
        const nextAccount = await result.connector.account(provider);
        if (ignore) {
          return;
        }
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

  const handleRegister = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!walletAccount) {
        setLastError("Connect your wallet before registering.");
        return;
      }
      if (!pollIdForCall) {
        setLastError("Invalid poll ID.");
        return;
      }

      setRegistering(true);
      setLastError(null);
      setRegisterTx(null);

      try {
        const commitment = toBigIntValue(commitmentInput.trim());
        if (commitment < 0n) {
          throw new Error("Commitment must be an unsigned u256.");
        }

        const registryWrite = createRegistryContract(
          resolvedRegistryAddress,
          walletAccount,
        );
        const tx = await registryWrite.register_commitment(
          pollIdForCall,
          toU256(commitment),
        );
        const txHash = getTxHash(tx);
        setRegisterTx(txHash);
        await provider.waitForTransaction(txHash);
        await loadOnChainState();
      } catch (error) {
        setLastError(errorMessage(error));
      } finally {
        setRegistering(false);
      }
    },
    [
      commitmentInput,
      loadOnChainState,
      pollIdForCall,
      provider,
      resolvedRegistryAddress,
      walletAccount,
    ],
  );

  const handleGenerateIdentity = useCallback(() => {
    try {
      const identity = generateIdentityData();
      setGeneratedIdentity(identity);
      setCommitmentInput(identity.commitment);
      setIdentityInput(identity.serialized);
      setLastError(null);
    } catch (error) {
      setLastError(errorMessage(error));
    }
  }, []);

  const handleDownloadIdentity = useCallback(() => {
    if (!generatedIdentity) {
      return;
    }

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

  const handleVote = useCallback(async () => {
    if (!walletAccount) {
      setLastError("Connect your wallet before voting.");
      return;
    }
    if (!pollIdForCall || !pollIdValidation.value) {
      setLastError("Invalid poll ID.");
      return;
    }
    if (selectedOption === null) {
      setLastError("Select an option to vote for.");
      return;
    }
    if (pollData?.exists && selectedOption >= pollData.optionsCount) {
      setLastError(
        `Option out of range. Poll supports options 0\u2013${Math.max(
          pollData.optionsCount - 1,
          0,
        )}.`,
      );
      return;
    }

    setVoting(true);
    setLastError(null);
    setVoteTx(null);
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
      setVoteTx(txHash);

      setVoteProgress("Waiting for confirmation\u2026");
      await provider.waitForTransaction(txHash);
      await loadOnChainState();
    } catch (error) {
      setLastError(errorMessage(error));
    } finally {
      setVoting(false);
      setVoteProgress(null);
    }
  }, [
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

  useEffect(() => {
    if (!pollIdForCall) {
      return;
    }
    void loadOnChainState();
    const interval = setInterval(() => {
      void loadOnChainState();
    }, 15_000);
    return () => clearInterval(interval);
  }, [loadOnChainState, pollIdForCall]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.22),transparent_40%),linear-gradient(180deg,#0f172a_0%,#020617_100%)] px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader
          pollIdParam={pollIdParam}
          pollAddress={DEFAULT_POLL_ADDRESS}
          registryAddress={resolvedRegistryAddress}
        />

        {pollIdValidation.error ? <ErrorAlert message={pollIdValidation.error} /> : null}
        {lastError ? <ErrorAlert message={lastError} /> : null}

        <section className="grid gap-4 lg:grid-cols-3">
          <WalletCard
            connected={Boolean(walletAccount)}
            walletName={walletName}
            accountAddress={accountAddress}
            connectingWallet={connectingWallet}
            onConnect={() => void connectWallet()}
            onDisconnect={() => void disconnectWallet()}
          />
          <PollStatusCard
            pollData={pollData}
            registryFrozen={registryFrozen}
            loadingState={loadingState}
            canRefresh={Boolean(pollIdForCall)}
            onRefresh={() => void loadOnChainState()}
          />
          <EligibilityCard
            eligibleForPoll={eligibleForPoll}
            alreadyRegistered={alreadyRegistered}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <RegisterCommitmentCard
            commitmentInput={commitmentInput}
            onCommitmentChange={setCommitmentInput}
            onSubmit={handleRegister}
            onGenerateIdentity={handleGenerateIdentity}
            onDownloadIdentity={handleDownloadIdentity}
            registering={registering}
            disabled={!walletAccount || !pollIdForCall}
            registerTx={registerTx}
            generatedIdentity={generatedIdentity}
          />
          <VoteCard
            pollData={pollData}
            optionLabels={optionLabels}
            selectedOption={selectedOption}
            onOptionSelect={setSelectedOption}
            identityInput={identityInput}
            onIdentityInputChange={setIdentityInput}
            hasSessionIdentity={Boolean(generatedIdentity)}
            onVote={() => void handleVote()}
            voting={voting}
            voteProgress={voteProgress}
            disabled={!walletAccount || !pollIdForCall}
            voteTx={voteTx}
            generatedProofDisplay={generatedProofDisplay}
          />
        </section>

        <PollDetailsCard pollData={pollData} tallies={tallies} />
      </div>
    </main>
  );
}
