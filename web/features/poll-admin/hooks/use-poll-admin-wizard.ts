"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { byteArray, shortString, type AccountInterface } from "starknet";
import { Group } from "@semaphore-protocol/group";
import { connect, disconnect } from "starknetkit";
import {
  DEFAULT_POLL_ADDRESS,
  DEFAULT_REGISTRY_ADDRESS,
  DEFAULT_RPC_URL,
  createPollContract,
  createProvider,
  createRegistryContract,
  fromU256,
  normalizeHex,
  parseAddressList,
  toAddress,
  toBoolean,
  toU256,
} from "@/lib/starkvote";
import { WIZARD_STEPS } from "../constants";
import type {
  BusyAction,
  LifecycleBadge,
  Notice,
  PollReadContract,
  PollStatus,
  PollWriteContract,
  RegistryReadContract,
  RegistryWriteContract,
} from "../types";
import {
  decodeByteArrayValue,
  getLifecycle,
  getMaxUnlockedStep,
  isConnectedWalletPollAdmin,
  parseOptionLabels,
  parseNonNegativeInt,
  parsePollId,
  toErrorMessage,
  toSafeNumber,
  txHashFromResult,
} from "../utils";

export type UsePollAdminWizardResult = {
  steps: typeof WIZARD_STEPS;
  lifecycle: LifecycleBadge;
  notice: Notice | null;
  clearNotice: () => void;
  status: PollStatus | null;
  lastTxHash: string;
  busyAction: BusyAction;
  isBusy: boolean;
  isWalletConnected: boolean;
  isPollAdmin: boolean;
  walletAddress: string;
  walletChainId: string;
  rpcUrl: string;
  pollAddress: string;
  registryAddress: string;
  pollIdInput: string;
  eligibleInput: string;
  optionsCountInput: string;
  durationInput: string;
  merkleRootInput: string;
  optionLabelsInput: string;
  isComputingRoot: boolean;
  currentStep: number;
  maxUnlockedStep: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  setRpcUrl: (value: string) => void;
  setPollAddress: (value: string) => void;
  setRegistryAddress: (value: string) => void;
  setPollIdInput: (value: string) => void;
  setEligibleInput: (value: string) => void;
  setOptionsCountInput: (value: string) => void;
  setDurationInput: (value: string) => void;
  setMerkleRootInput: (value: string) => void;
  setOptionLabelsInput: (value: string) => void;
  setCurrentStep: (value: number) => void;
  goPreviousStep: () => void;
  goNextStep: () => void;
  goToStep: (step: number) => void;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  refreshStatus: (showNotice?: boolean) => Promise<void>;
  addEligibleBatch: () => Promise<void>;
  freezeRegistry: () => Promise<void>;
  createPoll: () => Promise<void>;
  finalizePoll: () => Promise<void>;
  computeSnapshotRoot: () => Promise<void>;
};

function findCreatePollAbiEntry(abi: unknown): Record<string, unknown> | null {
  if (!Array.isArray(abi)) {
    return null;
  }

  for (const entry of abi) {
    if (
      entry &&
      typeof entry === "object" &&
      (entry as { type?: unknown }).type === "interface"
    ) {
      const items = (entry as { items?: unknown }).items;
      if (!Array.isArray(items)) {
        continue;
      }
      const createPoll = items.find(
        (item) =>
          item &&
          typeof item === "object" &&
          (item as { type?: unknown }).type === "function" &&
          (item as { name?: unknown }).name === "create_poll",
      ) as Record<string, unknown> | undefined;

      if (createPoll) {
        return createPoll;
      }
    }
  }

  const topLevelCreatePoll = abi.find(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      (entry as { type?: unknown }).type === "function" &&
      (entry as { name?: unknown }).name === "create_poll",
  ) as Record<string, unknown> | undefined;

  return topLevelCreatePoll ?? null;
}

function extractCreatePollInputCount(abi: unknown): number | null {
  const entry = findCreatePollAbiEntry(abi);
  if (!entry) {
    return null;
  }

  const inputs = entry.inputs;
  if (Array.isArray(inputs)) {
    return inputs.length;
  }

  return null;
}

function extractCreatePollOptionLabelsType(abi: unknown): string | null {
  const entry = findCreatePollAbiEntry(abi);
  if (!entry) {
    return null;
  }

  const inputs = entry.inputs;
  if (!Array.isArray(inputs) || inputs.length < 6) {
    return null;
  }

  const labelsArg = inputs.find((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }
    const name = (item as { name?: unknown }).name;
    return typeof name === "string" && name === "option_labels";
  }) ?? inputs[inputs.length - 1];

  if (labelsArg && typeof labelsArg === "object") {
    const type = (labelsArg as { type?: unknown }).type;
    if (typeof type === "string") {
      return type;
    }
  }

  return null;
}

function encodeByteArraySpan(values: string[]): string[] {
  const encoded: string[] = [String(values.length)];

  for (const value of values) {
    const byteArrayValue = byteArray.byteArrayFromString(value);
    encoded.push(String(byteArrayValue.data.length));
    for (const item of byteArrayValue.data) {
      encoded.push(String(item));
    }
    encoded.push(String(byteArrayValue.pending_word));
    encoded.push(String(byteArrayValue.pending_word_len));
  }

  return encoded;
}

function encodeFeltSpan(values: string[]): string[] {
  const encoded: string[] = [String(values.length)];

  for (const value of values) {
    if (!shortString.isShortText(value)) {
      throw new Error(
        `Option label "${value}" is too long for felt252 encoding. Use <=31 ASCII chars.`,
      );
    }
    encoded.push(shortString.encodeShortString(value));
  }

  return encoded;
}

export function usePollAdminWizard(): UsePollAdminWizardResult {
  const [rpcUrl, setRpcUrl] = useState(DEFAULT_RPC_URL);
  const [pollAddress, setPollAddress] = useState(DEFAULT_POLL_ADDRESS);
  const [registryAddress, setRegistryAddress] = useState(DEFAULT_REGISTRY_ADDRESS);
  const provider = useMemo(() => createProvider(rpcUrl), [rpcUrl]);

  const [walletAccount, setWalletAccount] = useState<AccountInterface | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletChainId, setWalletChainId] = useState("");

  const [pollIdInput, setPollIdInput] = useState(() =>
    String(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
  );
  const [eligibleInput, setEligibleInput] = useState("");

  const [optionsCountInput, setOptionsCountInput] = useState("2");
  const [durationInput, setDurationInput] = useState("120");
  const [merkleRootInput, setMerkleRootInput] = useState("");
  const [optionLabelsInput, setOptionLabelsInput] = useState("Yes\nNo");

  const [status, setStatus] = useState<PollStatus | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [lastTxHash, setLastTxHash] = useState("");
  const [busyAction, setBusyAction] = useState<BusyAction>("");
  const [isComputingRoot, setIsComputingRoot] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const hasAutoAdvanced = useRef(false);

  const isWalletConnected = Boolean(walletAccount && walletAddress);
  const isBusy = Boolean(busyAction);
  const lifecycle = useMemo(() => getLifecycle(status), [status]);
  const isPollAdmin = useMemo(
    () => isConnectedWalletPollAdmin(status, walletAddress),
    [status, walletAddress],
  );
  const maxUnlockedStep = useMemo(
    () => getMaxUnlockedStep(isWalletConnected, status),
    [isWalletConnected, status],
  );

  const canGoPrevious = currentStep > 1;
  const canGoNext = currentStep < 5 && currentStep < maxUnlockedStep;

  const connectWallet = useCallback(async () => {
    try {
      const result = await connect({
        modalMode: "alwaysAsk",
        modalTheme: "light",
        dappName: "StarkVote Admin",
      });

      if (!result.connector) {
        throw new Error("Wallet connection was cancelled.");
      }

      const account = await result.connector.account(provider);
      const address = toAddress(account.address);
      setWalletAccount(account);
      setWalletAddress(address);
      const chainIdFromConnect = result.connectorData?.chainId;
      setWalletChainId(chainIdFromConnect ? chainIdFromConnect.toString() : "");
      setCurrentStep((value) => Math.max(value, 2));
      setNotice(null);
    } catch (error) {
      setNotice({ type: "error", message: toErrorMessage(error) });
    }
  }, [provider]);

  const disconnectWallet = useCallback(async () => {
    try {
      await disconnect({ clearLastWallet: true });
    } catch {
      // Ignore disconnect failures and clear local state.
    }

    setWalletAccount(null);
    setWalletAddress("");
    setWalletChainId("");
    setCurrentStep(1);
    setNotice({ type: "info", message: "Wallet connection cleared in UI." });
  }, []);

  useEffect(() => {
    let ignore = false;

    const reconnectSilently = async () => {
      try {
        const result = await connect({
          modalMode: "neverAsk",
          modalTheme: "light",
          dappName: "StarkVote Admin",
        });

        if (!result.connector || ignore) {
          return;
        }

        const account = await result.connector.account(provider);
        if (ignore) {
          return;
        }

        const address = toAddress(account.address);
        setWalletAccount(account);
        setWalletAddress(address);
        const chainIdFromConnect = result.connectorData?.chainId;
        setWalletChainId(chainIdFromConnect ? chainIdFromConnect.toString() : "");
        setCurrentStep((value) => Math.max(value, 2));
      } catch {
        // No previous session is expected for first-time users.
      }
    };

    void reconnectSilently();

    return () => {
      ignore = true;
    };
  }, [provider]);

  useEffect(() => {
    if (currentStep > maxUnlockedStep) {
      setCurrentStep(maxUnlockedStep);
    }
  }, [currentStep, maxUnlockedStep]);

  useEffect(() => {
    if (status && !hasAutoAdvanced.current) {
      hasAutoAdvanced.current = true;
      setCurrentStep((value) => Math.max(value, maxUnlockedStep));
    }
  }, [status, maxUnlockedStep]);

  const refreshStatus = useCallback(
    async (showNotice = true) => {
      try {
        const pollId = parsePollId(pollIdInput);
        const registry = createRegistryContract(
          registryAddress,
          provider,
        ) as unknown as RegistryReadContract;
        const poll = createPollContract(pollAddress, provider) as unknown as PollReadContract;

        const [frozenRaw, leafCountRaw, pollAdminRaw, pollRaw] = await Promise.all([
          registry.is_frozen(pollId),
          registry.get_leaf_count(pollId),
          registry.get_poll_admin(pollId),
          poll.get_poll(pollId),
        ]);

        const pollData = (pollRaw ?? {}) as Record<string, unknown>;
        const exists = toBoolean(pollData.exists);
        const optionsCount = toSafeNumber(pollData.options_count ?? 0n);

        let tallies: PollStatus["tallies"] = [];
        let optionLabels: string[] = [];
        if (exists && optionsCount > 0) {
          const calls = Array.from({ length: optionsCount }, (_, option) =>
            poll.get_tally(pollId, option),
          );
          const results = await Promise.all(calls);
          tallies = results.map((value, option) => ({
            option,
            votes: toSafeNumber(value),
          }));

          try {
            const labelsResult = await poll.get_option_labels(pollId);
            if (Array.isArray(labelsResult)) {
              optionLabels = labelsResult.map((value) => decodeByteArrayValue(value));
            }
          } catch {
            // Legacy Poll deployments may not expose option labels.
            optionLabels = [];
          }
        }

        setStatus({
          pollId,
          exists,
          optionsCount,
          optionLabels,
          startTime: toSafeNumber(pollData.start_time ?? 0n),
          endTime: toSafeNumber(pollData.end_time ?? 0n),
          snapshotRoot: `0x${fromU256(pollData.snapshot_root ?? 0n).toString(16)}`,
          finalized: toBoolean(pollData.finalized),
          winnerOption: toSafeNumber(pollData.winner_option ?? 0n),
          maxVotes: toSafeNumber(pollData.max_votes ?? 0n),
          frozen: toBoolean(frozenRaw),
          leafCount: toSafeNumber(leafCountRaw),
          pollAdmin: toAddress(pollAdminRaw),
          tallies,
        });

        if (showNotice) {
          setNotice({ type: "success", message: "On-chain status refreshed." });
        }
      } catch (error) {
        setNotice({ type: "error", message: toErrorMessage(error) });
      }
    },
    [pollAddress, pollIdInput, provider, registryAddress],
  );

  const runWriteAction = useCallback(
    async (
      actionName: Exclude<BusyAction, "">,
      action: (pollId: number) => Promise<string>,
    ): Promise<boolean> => {
      try {
        if (!walletAccount) {
          throw new Error("Connect a wallet before sending transactions.");
        }

        const pollId = parsePollId(pollIdInput);
        setBusyAction(actionName);
        setNotice({ type: "info", message: `${actionName} submitted...` });

        const txHash = await action(pollId);
        setLastTxHash(txHash);
        setNotice({ type: "success", message: `${actionName} confirmed: ${txHash}` });
        await refreshStatus(false);
        return true;
      } catch (error) {
        setNotice({ type: "error", message: toErrorMessage(error) });
        return false;
      } finally {
        setBusyAction("");
      }
    },
    [pollIdInput, refreshStatus, walletAccount],
  );

  const addEligibleBatch = useCallback(async () => {
    const success = await runWriteAction("add_eligible_batch", async (pollId) => {
      const addresses = parseAddressList(eligibleInput);
      if (!addresses.length) {
        throw new Error("Provide at least one eligible wallet address.");
      }

      const registry = createRegistryContract(
        registryAddress,
        walletAccount!,
      ) as unknown as RegistryWriteContract;
      const isFrozenNow = toBoolean(await registry.is_frozen(pollId));
      if (isFrozenNow) {
        throw new Error(
          "Voter set is already frozen for this poll ID. Use a new poll ID to add eligible voters.",
        );
      }
      const txResult = await registry.add_eligible_batch(pollId, addresses);
      const txHash = txHashFromResult(txResult);
      await provider.waitForTransaction(txHash);
      return txHash;
    });

    if (success) {
      setCurrentStep((value) => Math.max(value, 3));
    }
  }, [eligibleInput, provider, registryAddress, runWriteAction, walletAccount]);

  const freezeRegistry = useCallback(async () => {
    const success = await runWriteAction("freeze", async (pollId) => {
      const registry = createRegistryContract(
        registryAddress,
        walletAccount!,
      ) as unknown as RegistryWriteContract;
      const isFrozenNow = toBoolean(await registry.is_frozen(pollId));
      if (isFrozenNow) {
        throw new Error("Voter set is already frozen for this poll ID.");
      }
      const txResult = await registry.freeze(pollId);
      const txHash = txHashFromResult(txResult);
      await provider.waitForTransaction(txHash);
      return txHash;
    });

    if (success) {
      setCurrentStep((value) => Math.max(value, 4));
    }
  }, [provider, registryAddress, runWriteAction, walletAccount]);

  const createPoll = useCallback(async () => {
    const success = await runWriteAction("create_poll", async (pollId) => {
      const optionsCount = parseNonNegativeInt(optionsCountInput, "Options count");
      if (optionsCount <= 0 || optionsCount > 255) {
        throw new Error("Options count must be between 1 and 255.");
      }

      const duration = parseNonNegativeInt(durationInput, "Duration");
      if (duration <= 0) {
        throw new Error("Duration must be greater than 0 seconds.");
      }
      const startTime = Math.floor(Date.now() / 1000);
      const endTime = startTime + duration;
      if (!merkleRootInput.trim()) {
        throw new Error("Merkle root is required.");
      }
      const optionLabels = parseOptionLabels(optionLabelsInput);
      if (optionLabels.length !== optionsCount) {
        throw new Error(`Expected ${optionsCount} option labels, received ${optionLabels.length}.`);
      }

      const registryRead = createRegistryContract(
        registryAddress,
        provider,
      ) as unknown as RegistryReadContract;
      const isFrozenNow = toBoolean(await registryRead.is_frozen(pollId));
      if (!isFrozenNow) {
        throw new Error("Voter set must be frozen before creating a poll.");
      }

      const normalizedPollAddress = normalizeHex(pollAddress);
      const merkleRootU256 = toU256(merkleRootInput.trim());

      const containsInputTooLongError = (value: unknown): boolean => {
        const queue: unknown[] = [value];
        const visited = new Set<object>();

        while (queue.length > 0) {
          const current = queue.shift();
          if (typeof current === "string") {
            if (current.toLowerCase().includes("input too long for arguments")) {
              return true;
            }
            continue;
          }
          if (!current || typeof current !== "object") {
            continue;
          }
          if (visited.has(current as object)) {
            continue;
          }
          visited.add(current as object);
          if (current instanceof Error) {
            queue.push(current.message);
            queue.push(current.stack);
          }
          for (const nested of Object.values(current as Record<string, unknown>)) {
            queue.push(nested);
          }
        }

        return false;
      };

      let createPollInputCount = 6;
      let optionLabelsEncoding: "byte_array" | "felt252" = "byte_array";
      try {
        const classAt = await provider.getClassAt(normalizedPollAddress);
        const abi = (classAt as { abi?: unknown }).abi;
        const detected = extractCreatePollInputCount(
          abi,
        );
        if (detected) {
          createPollInputCount = detected;
        }
        const optionLabelsType = extractCreatePollOptionLabelsType(abi);
        if (optionLabelsType && optionLabelsType.includes("felt252")) {
          optionLabelsEncoding = "felt252";
        }
      } catch {
        // Fall back to the latest known signature if ABI lookup fails.
      }

      const modernCalldata = () => {
        const optionLabelsCalldata =
          optionLabelsEncoding === "felt252"
            ? encodeFeltSpan(optionLabels)
            : encodeByteArraySpan(optionLabels);
        return [
          String(pollId),
          String(optionsCount),
          String(startTime),
          String(endTime),
          merkleRootU256.low,
          merkleRootU256.high,
          ...optionLabelsCalldata,
        ];
      };

      const legacyRootCalldata = () => [
        String(pollId),
        String(optionsCount),
        String(startTime),
        String(endTime),
        merkleRootU256.low,
        merkleRootU256.high,
      ];

      const legacyBasicCalldata = () => [
        String(pollId),
        String(optionsCount),
        String(startTime),
        String(endTime),
      ];

      const initialCalldata =
        createPollInputCount >= 6
          ? modernCalldata()
          : createPollInputCount === 5
            ? legacyRootCalldata()
            : legacyBasicCalldata();

      // Work around starknet.js parser issues for Span<ByteArray> by compiling calldata
      // explicitly and executing the entrypoint directly.
      let txResult: { transaction_hash: string };
      try {
        txResult = await walletAccount!.execute({
          contractAddress: normalizedPollAddress,
          entrypoint: "create_poll",
          calldata: initialCalldata,
        });
      } catch (error) {
        const isLegacyCreatePollSignature = containsInputTooLongError(error);

        if (!isLegacyCreatePollSignature) {
          throw error;
        }

        try {
        // Legacy Poll deployments use create_poll without option_labels.
        txResult = await walletAccount!.execute({
          contractAddress: normalizedPollAddress,
          entrypoint: "create_poll",
          calldata: legacyRootCalldata(),
        });
      } catch (legacyError) {
        if (!containsInputTooLongError(legacyError)) {
          throw legacyError;
        }

          // Oldest deployments may have create_poll without snapshot root and labels.
        txResult = await walletAccount!.execute({
          contractAddress: normalizedPollAddress,
          entrypoint: "create_poll",
          calldata: legacyBasicCalldata(),
        });
      }
      }

      const txHash = txHashFromResult(txResult);
      await provider.waitForTransaction(txHash);
      return txHash;
    });

    if (success) {
      setCurrentStep(5);
    }
  }, [
    durationInput,
    merkleRootInput,
    optionLabelsInput,
    optionsCountInput,
    provider,
    pollAddress,
    registryAddress,
    runWriteAction,
    walletAccount,
  ]);

  const finalizePoll = useCallback(async () => {
    await runWriteAction("finalize", async (pollId) => {
      const poll = createPollContract(pollAddress, walletAccount!) as unknown as PollWriteContract;
      const txResult = await poll.finalize(pollId);
      const txHash = txHashFromResult(txResult);
      await provider.waitForTransaction(txHash);
      return txHash;
    });
  }, [pollAddress, provider, runWriteAction, walletAccount]);

  const computeSnapshotRoot = useCallback(async () => {
    try {
      setIsComputingRoot(true);
      const pollId = parsePollId(pollIdInput);
      const registry = createRegistryContract(
        registryAddress,
        provider,
      ) as unknown as RegistryReadContract;

      const [isFrozenRaw, leafCountRaw] = await Promise.all([
        registry.is_frozen(pollId),
        registry.get_leaf_count(pollId),
      ]);
      const isFrozenNow = toBoolean(isFrozenRaw);
      if (!isFrozenNow) {
        throw new Error("Voter set must be frozen before computing snapshot root.");
      }

      const leafCount = toSafeNumber(leafCountRaw);
      const leaves: bigint[] = [];
      for (let index = 0; index < leafCount; index += 1) {
        const leafRaw = await registry.get_leaf(pollId, index);
        leaves.push(fromU256(leafRaw));
      }

      const group = new Group(leaves);
      const root = BigInt(group.root.toString());
      setMerkleRootInput(root.toString());
      setNotice({
        type: "success",
        message: `Computed snapshot root from ${leafCount} leaf/leaves: 0x${root.toString(16)}`,
      });
    } catch (error) {
      setNotice({ type: "error", message: toErrorMessage(error) });
    } finally {
      setIsComputingRoot(false);
    }
  }, [pollIdInput, provider, registryAddress]);

  const goPreviousStep = useCallback(() => {
    setCurrentStep((value) => Math.max(1, value - 1));
  }, []);

  const goNextStep = useCallback(() => {
    setCurrentStep((value) => Math.min(5, value + 1));
  }, []);

  const goToStep = useCallback(
    (step: number) => {
      if (step < 1 || step > 5 || step > maxUnlockedStep) {
        return;
      }
      setCurrentStep(step);
    },
    [maxUnlockedStep],
  );

  return {
    steps: WIZARD_STEPS,
    lifecycle,
    notice,
    clearNotice: useCallback(() => setNotice(null), []),
    status,
    lastTxHash,
    busyAction,
    isBusy,
    isWalletConnected,
    isPollAdmin,
    walletAddress,
    walletChainId,
    rpcUrl,
    pollAddress,
    registryAddress,
    pollIdInput,
    eligibleInput,
    optionsCountInput,
    durationInput,
    merkleRootInput,
    optionLabelsInput,
    isComputingRoot,
    currentStep,
    maxUnlockedStep,
    canGoPrevious,
    canGoNext,
    setRpcUrl,
    setPollAddress,
    setRegistryAddress,
    setPollIdInput,
    setEligibleInput,
    setOptionsCountInput,
    setDurationInput,
    setMerkleRootInput,
    setOptionLabelsInput,
    setCurrentStep,
    goPreviousStep,
    goNextStep,
    goToStep,
    connectWallet,
    disconnectWallet,
    refreshStatus,
    addEligibleBatch,
    freezeRegistry,
    createPoll,
    finalizePoll,
    computeSnapshotRoot,
  };
}
