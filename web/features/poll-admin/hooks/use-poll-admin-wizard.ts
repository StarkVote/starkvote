"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { byteArray, shortString, type AccountInterface } from "starknet";
import { Group } from "@semaphore-protocol/group";
import { connect, disconnect, type StarknetkitConnector } from "starknetkit";
import {
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
import {
  usePollAdminStore,
  useActiveAddressData,
  useActivePollKey,
  getActiveEntryFromState,
} from "../store";
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
  getLifecycle,
  getMaxUnlockedStep,
  isConnectedWalletPollAdmin,
  parseContractOptionLabels,
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
  eligibleAddresses: string[];
  registeredVoters: Set<string>;
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
  startNewPoll: () => void;
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
  const store = usePollAdminStore();
  const addressData = useActiveAddressData();
  const activePollKey = useActivePollKey();

  const {
    rpcUrl,
    pollAddress,
    registryAddress,
    walletAddress,
    walletChainId,
    notice,
    busyAction,
    isComputingRoot,
  } = store;

  const {
    pollIdInput,
    eligibleInput,
    optionsCountInput,
    durationInput,
    merkleRootInput,
    optionLabelsInput,
    currentStep,
    lastTxHash,
    eligibleAddresses,
    status,
  } = addressData;

  const provider = useMemo(() => createProvider(rpcUrl), [rpcUrl]);

  const walletAccountRef = useRef<AccountInterface | null>(null);
  const connectorRef = useRef<StarknetkitConnector | null>(null);
  const hasAutoAdvanced = useRef(false);
  const prevWalletAddressRef = useRef(walletAddress);
  const [registeredVoters, setRegisteredVoters] = useState<Set<string>>(new Set());

  const isWalletConnected = Boolean(walletAccountRef.current && walletAddress);
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
  const canGoNext = currentStep < 4 && currentStep < maxUnlockedStep;

  // --- Field setters ---
  const setRpcUrl = useCallback(
    (v: string) => usePollAdminStore.getState().setRpcUrl(v),
    [],
  );
  const setPollAddress = useCallback(
    (v: string) => usePollAdminStore.getState().setPollAddress(v),
    [],
  );
  const setRegistryAddress = useCallback(
    (v: string) => usePollAdminStore.getState().setRegistryAddress(v),
    [],
  );
  const setPollIdInput = useCallback(
    (v: string) => usePollAdminStore.getState().setAddressField("pollIdInput", v),
    [],
  );
  const setEligibleInput = useCallback(
    (v: string) => usePollAdminStore.getState().setAddressField("eligibleInput", v),
    [],
  );
  const setOptionsCountInput = useCallback(
    (v: string) => usePollAdminStore.getState().setAddressField("optionsCountInput", v),
    [],
  );
  const setDurationInput = useCallback(
    (v: string) => usePollAdminStore.getState().setAddressField("durationInput", v),
    [],
  );
  const setMerkleRootInput = useCallback(
    (v: string) => usePollAdminStore.getState().setAddressField("merkleRootInput", v),
    [],
  );
  const setOptionLabelsInput = useCallback(
    (v: string) => usePollAdminStore.getState().setAddressField("optionLabelsInput", v),
    [],
  );
  const setCurrentStep = useCallback(
    (v: number) => usePollAdminStore.getState().setAddressField("currentStep", v),
    [],
  );

  // --- Wallet account change listener ---
  const subscribeToConnector = useCallback(
    (connector: StarknetkitConnector) => {
      // Unsubscribe from the previous connector
      if (connectorRef.current) {
        connectorRef.current.removeAllListeners("change");
        connectorRef.current.removeAllListeners("disconnect");
      }
      connectorRef.current = connector;

      connector.on("change", async (data) => {
        if (data.account) {
          try {
            const account = await connector.account(provider);
            const address = toAddress(account.address);
            walletAccountRef.current = account;
            const chainId = data.chainId ? data.chainId.toString() : "";

            const s = usePollAdminStore.getState();
            s.setWalletIdentity(address, chainId);

            const addrData = getActiveEntryFromState(usePollAdminStore.getState());
            if (addrData && addrData.currentStep < 2) {
              usePollAdminStore.getState().setAddressField("currentStep", 2);
            }
          } catch {
            // Connector may have been invalidated.
          }
        }
      });

      connector.on("disconnect", () => {
        walletAccountRef.current = null;
        connectorRef.current = null;
        const s = usePollAdminStore.getState();
        s.clearWalletIdentity();
        s.setNotice({ type: "info", message: "Wallet disconnected." });
      });
    },
    [provider],
  );

  // Clean up connector listeners on unmount
  useEffect(() => {
    return () => {
      if (connectorRef.current) {
        connectorRef.current.removeAllListeners("change");
        connectorRef.current.removeAllListeners("disconnect");
      }
    };
  }, []);

  // --- Wallet actions ---
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
      walletAccountRef.current = account;
      const chainIdFromConnect = result.connectorData?.chainId;
      const chainId = chainIdFromConnect ? chainIdFromConnect.toString() : "";

      subscribeToConnector(result.connector);

      const s = usePollAdminStore.getState();
      s.setWalletIdentity(address, chainId);
      s.setNotice(null);

      // Advance to at least step 2
      const addrData = getActiveEntryFromState(usePollAdminStore.getState());
      if (addrData && addrData.currentStep < 2) {
        usePollAdminStore.getState().setAddressField("currentStep", 2);
      }
    } catch (error) {
      usePollAdminStore.getState().setNotice({ type: "error", message: toErrorMessage(error) });
    }
  }, [provider, subscribeToConnector]);

  const disconnectWallet = useCallback(async () => {
    try {
      await disconnect({ clearLastWallet: true });
    } catch {
      // Ignore disconnect failures and clear local state.
    }

    if (connectorRef.current) {
      connectorRef.current.removeAllListeners("change");
      connectorRef.current.removeAllListeners("disconnect");
      connectorRef.current = null;
    }
    walletAccountRef.current = null;
    const s = usePollAdminStore.getState();
    s.clearWalletIdentity();
    s.setNotice({ type: "info", message: "Wallet connection cleared in UI." });
  }, []);

  // Silent reconnect on mount
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
        walletAccountRef.current = account;
        const chainIdFromConnect = result.connectorData?.chainId;
        const chainId = chainIdFromConnect ? chainIdFromConnect.toString() : "";

        subscribeToConnector(result.connector);

        const s = usePollAdminStore.getState();
        s.setWalletIdentity(address, chainId);

        // Advance to at least step 2
        const addrData = getActiveEntryFromState(usePollAdminStore.getState());
        if (addrData && addrData.currentStep < 2) {
          usePollAdminStore.getState().setAddressField("currentStep", 2);
        }
      } catch {
        // No previous session is expected for first-time users.
      }
    };

    void reconnectSilently();

    return () => {
      ignore = true;
    };
  }, [provider, subscribeToConnector]);

  // --- refreshStatus ---
  const refreshStatus = useCallback(
    async (showNotice = true) => {
      try {
        const s = usePollAdminStore.getState();
        const addrData = getActiveEntryFromState(s);
        const currentPollIdInput = addrData?.pollIdInput ?? "";

        const pollId = parsePollId(currentPollIdInput);
        const registry = createRegistryContract(
          s.registryAddress,
          provider,
        ) as unknown as RegistryReadContract;
        const poll = createPollContract(s.pollAddress, provider) as unknown as PollReadContract;

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
            optionLabels = parseContractOptionLabels(labelsResult);
          } catch {
            // Legacy Poll deployments may not expose option labels.
            optionLabels = [];
          }
        }

        const newStatus: PollStatus = {
          pollId,
          exists,
          optionsCount,
          optionLabels,
          startTime: toSafeNumber(pollData.start_time ?? 0n),
          endTime: toSafeNumber(pollData.end_time ?? 0n),
          snapshotRoot: `0x${fromU256(pollData.snapshot_root ?? 0n).toString(16)}`,
          finalized: toBoolean(pollData.finalized),
          isDraw: toBoolean(pollData.is_draw ?? false),
          winnerOption: toSafeNumber(pollData.winner_option ?? 0n),
          maxVotes: toSafeNumber(pollData.max_votes ?? 0n),
          frozen: toBoolean(frozenRaw),
          leafCount: toSafeNumber(leafCountRaw),
          pollAdmin: toAddress(pollAdminRaw),
          tallies,
        };

        usePollAdminStore.getState().setStatus(newStatus);

        if (showNotice) {
          usePollAdminStore.getState().setNotice({ type: "success", message: "On-chain status refreshed." });
        }
      } catch (error) {
        usePollAdminStore.getState().setNotice({ type: "error", message: toErrorMessage(error) });
      }
    },
    [provider],
  );

  // Show notice when the connected wallet address changes
  useEffect(() => {
    const prev = prevWalletAddressRef.current;
    prevWalletAddressRef.current = walletAddress;
    if (!walletAddress || !prev || prev === walletAddress) return;
    usePollAdminStore.getState().setNotice({
      type: "info",
      message: `Wallet changed to ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
    });
  }, [walletAddress]);

  // Hydrate on-chain data when wallet address or active poll changes
  useEffect(() => {
    if (walletAddress && activePollKey) {
      hasAutoAdvanced.current = false;
      void refreshStatus(false);
    }
  }, [walletAddress, activePollKey, refreshStatus]);

  // Clamp current step when maxUnlockedStep decreases
  useEffect(() => {
    if (currentStep > maxUnlockedStep) {
      usePollAdminStore.getState().setAddressField("currentStep", maxUnlockedStep);
    }
  }, [currentStep, maxUnlockedStep]);

  // Auto-advance to the maximum unlocked step on first status load
  useEffect(() => {
    if (status && !hasAutoAdvanced.current) {
      hasAutoAdvanced.current = true;
      const addrData = getActiveEntryFromState(usePollAdminStore.getState());
      const curStep = addrData?.currentStep ?? 1;
      if (curStep < maxUnlockedStep) {
        usePollAdminStore.getState().setAddressField("currentStep", maxUnlockedStep);
      }
    }
  }, [status, maxUnlockedStep]);

  // --- Check registration status for eligible addresses ---
  const checkRegistrations = useCallback(async () => {
    try {
      const s = usePollAdminStore.getState();
      const addrData = getActiveEntryFromState(s);
      if (!addrData || addrData.eligibleAddresses.length === 0) return;

      const pollId = parsePollId(addrData.pollIdInput);
      const registry = createRegistryContract(
        s.registryAddress,
        provider,
      ) as unknown as RegistryReadContract;

      const results = await Promise.all(
        addrData.eligibleAddresses.map((addr) =>
          registry.has_registered(pollId, addr).then(
            (raw) => ({ addr, registered: toBoolean(raw) }),
            () => ({ addr, registered: false }),
          ),
        ),
      );

      const newSet = new Set<string>();
      for (const { addr, registered } of results) {
        if (registered) newSet.add(addr);
      }
      setRegisteredVoters(newSet);
    } catch {
      // Silently ignore — polling will retry.
    }
  }, [provider]);

  // Reset registeredVoters when active poll changes
  useEffect(() => {
    setRegisteredVoters(new Set());
  }, [activePollKey]);

  // Poll registration status when there are eligible addresses
  useEffect(() => {
    if (eligibleAddresses.length === 0) return;

    // Initial check
    void checkRegistrations();

    const interval = setInterval(() => {
      void checkRegistrations();
    }, 1_000);

    return () => clearInterval(interval);
  }, [eligibleAddresses.length, checkRegistrations]);

  // --- Write actions ---
  const runWriteAction = useCallback(
    async (
      actionName: Exclude<BusyAction, "">,
      action: (pollId: number) => Promise<string>,
    ): Promise<boolean> => {
      try {
        if (!walletAccountRef.current) {
          throw new Error("Connect a wallet before sending transactions.");
        }

        const s = usePollAdminStore.getState();
        const addrData = getActiveEntryFromState(s);
        const currentPollIdInput = addrData?.pollIdInput ?? "";

        const pollId = parsePollId(currentPollIdInput);
        s.setBusyAction(actionName);
        s.setNotice({ type: "info", message: `${actionName} submitted...` });

        const txHash = await action(pollId);
        usePollAdminStore.getState().setAddressField("lastTxHash", txHash);
        usePollAdminStore.getState().setNotice({ type: "success", message: `${actionName} confirmed: ${txHash}` });
        await refreshStatus(false);
        return true;
      } catch (error) {
        usePollAdminStore.getState().setNotice({ type: "error", message: toErrorMessage(error) });
        return false;
      } finally {
        usePollAdminStore.getState().setBusyAction("");
      }
    },
    [refreshStatus],
  );

  const addEligibleBatch = useCallback(async () => {
    let submittedAddresses: string[] = [];
    const success = await runWriteAction("add_eligible_batch", async (pollId) => {
      const s = usePollAdminStore.getState();
      const addrData = getActiveEntryFromState(s);
      const currentEligibleInput = addrData?.eligibleInput ?? "";

      const inputAddresses = parseAddressList(currentEligibleInput);

      // Always include the admin address first
      const adminAddr = s.walletAddress;
      const existingSet = new Set(addrData?.eligibleAddresses ?? []);
      const addresses: string[] = [];
      if (adminAddr && !existingSet.has(adminAddr)) {
        addresses.push(adminAddr);
      }
      for (const addr of inputAddresses) {
        if (addr.toLowerCase() !== adminAddr.toLowerCase() && !existingSet.has(addr)) {
          addresses.push(addr);
        }
      }
      if (!addresses.length) {
        throw new Error("Provide at least one eligible wallet address.");
      }
      submittedAddresses = addresses;

      const registry = createRegistryContract(
        s.registryAddress,
        walletAccountRef.current!,
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

    if (success && submittedAddresses.length > 0) {
      const s = usePollAdminStore.getState();
      s.appendEligibleAddresses(submittedAddresses);
      s.setAddressField("eligibleInput", "");
    }

    // Stay on step 2 so the admin can add more addresses before freezing.
  }, [provider, runWriteAction]);

  const freezeRegistry = useCallback(async () => {
    const success = await runWriteAction("freeze", async (pollId) => {
      const s = usePollAdminStore.getState();
      const registry = createRegistryContract(
        s.registryAddress,
        walletAccountRef.current!,
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
      const addrData = getActiveEntryFromState(usePollAdminStore.getState());
      const curStep = addrData?.currentStep ?? 1;
      if (curStep < 3) {
        usePollAdminStore.getState().setAddressField("currentStep", 3);
      }
    }
  }, [provider, runWriteAction]);

  const computeSnapshotRoot = useCallback(async () => {
    try {
      usePollAdminStore.getState().setIsComputingRoot(true);

      const s = usePollAdminStore.getState();
      const addrData = getActiveEntryFromState(s);
      const currentPollIdInput = addrData?.pollIdInput ?? "";

      const pollId = parsePollId(currentPollIdInput);
      const registry = createRegistryContract(
        s.registryAddress,
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
      usePollAdminStore.getState().setAddressField("merkleRootInput", root.toString());
      usePollAdminStore.getState().setNotice({
        type: "success",
        message: `Computed snapshot root from ${leafCount} leaf/leaves: 0x${root.toString(16)}`,
      });
    } catch (error) {
      usePollAdminStore.getState().setNotice({ type: "error", message: toErrorMessage(error) });
    } finally {
      usePollAdminStore.getState().setIsComputingRoot(false);
    }
  }, [provider]);

  const createPoll = useCallback(async () => {
    // Auto-compute snapshot root before creating the poll
    await computeSnapshotRoot();

    const success = await runWriteAction("create_poll", async (pollId) => {
      const s = usePollAdminStore.getState();
      const addrData = getActiveEntryFromState(s);

      const currentDurationInput = addrData?.durationInput ?? "120";
      const currentMerkleRootInput = addrData?.merkleRootInput ?? "";
      const currentOptionLabelsInput = addrData?.optionLabelsInput ?? "Yes\nNo";

      const optionLabels = parseOptionLabels(currentOptionLabelsInput);
      const optionsCount = optionLabels.length;
      if (optionsCount < 2 || optionsCount > 255) {
        throw new Error("Add at least 2 options (max 255).");
      }

      const duration = parseNonNegativeInt(currentDurationInput, "Duration");
      if (duration <= 0) {
        throw new Error("Duration must be greater than 0 seconds.");
      }
      const startTime = Math.floor(Date.now() / 1000);
      const endTime = startTime + duration;
      if (!currentMerkleRootInput.trim()) {
        throw new Error("Merkle root is required. No registered voters found.");
      }

      const registryRead = createRegistryContract(
        s.registryAddress,
        provider,
      ) as unknown as RegistryReadContract;
      const isFrozenNow = toBoolean(await registryRead.is_frozen(pollId));
      if (!isFrozenNow) {
        throw new Error("Voter set must be frozen before creating a poll.");
      }

      const normalizedPollAddress = normalizeHex(s.pollAddress);
      const merkleRootU256 = toU256(currentMerkleRootInput.trim());

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
        const detected = extractCreatePollInputCount(abi);
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
        txResult = await walletAccountRef.current!.execute({
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
        txResult = await walletAccountRef.current!.execute({
          contractAddress: normalizedPollAddress,
          entrypoint: "create_poll",
          calldata: legacyRootCalldata(),
        });
      } catch (legacyError) {
        if (!containsInputTooLongError(legacyError)) {
          throw legacyError;
        }

          // Oldest deployments may have create_poll without snapshot root and labels.
        txResult = await walletAccountRef.current!.execute({
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
      usePollAdminStore.getState().setAddressField("currentStep", 4);
    }
  }, [provider, runWriteAction, computeSnapshotRoot]);

  const finalizePoll = useCallback(async () => {
    await runWriteAction("finalize", async (pollId) => {
      const s = usePollAdminStore.getState();
      const poll = createPollContract(s.pollAddress, walletAccountRef.current!) as unknown as PollWriteContract;
      const txResult = await poll.finalize(pollId);
      const txHash = txHashFromResult(txResult);
      await provider.waitForTransaction(txHash);
      return txHash;
    });
  }, [provider, runWriteAction]);

  const goPreviousStep = useCallback(() => {
    const addrData = getActiveEntryFromState(usePollAdminStore.getState());
    const curStep = addrData?.currentStep ?? 1;
    usePollAdminStore.getState().setAddressField("currentStep", Math.max(1, curStep - 1));
  }, []);

  const goNextStep = useCallback(() => {
    const addrData = getActiveEntryFromState(usePollAdminStore.getState());
    const curStep = addrData?.currentStep ?? 1;
    usePollAdminStore.getState().setAddressField("currentStep", Math.min(4, curStep + 1));
  }, []);

  const goToStep = useCallback(
    (step: number) => {
      if (step < 1 || step > 4 || step > maxUnlockedStep) {
        return;
      }
      usePollAdminStore.getState().setAddressField("currentStep", step);
    },
    [maxUnlockedStep],
  );

  const startNewPoll = useCallback(() => {
    usePollAdminStore.getState().startNewPoll();
  }, []);

  return {
    steps: WIZARD_STEPS,
    lifecycle,
    notice,
    clearNotice: useCallback(() => usePollAdminStore.getState().setNotice(null), []),
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
    eligibleAddresses,
    registeredVoters,
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
    startNewPoll,
  };
}
