import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_POLL_ADDRESS,
  DEFAULT_REGISTRY_ADDRESS,
  DEFAULT_RPC_URL,
} from "@/lib/starkvote";
import type { AddressData, BusyAction, Notice, PollStatus } from "./types";

export const DEFAULT_ADDRESS_DATA: AddressData = {
  pollIdInput: "",
  eligibleInput: "",
  optionsCountInput: "2",
  durationInput: "120",
  merkleRootInput: "",
  optionLabelsInput: "Yes\nNo",
  currentStep: 1,
  lastTxHash: "",
  eligibleAddresses: [],
  status: null,
};

function generatePollId(): string {
  return String(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
}

function createDefaultAddressData(): AddressData {
  return { ...DEFAULT_ADDRESS_DATA, pollIdInput: generatePollId() };
}

// Composite key helpers
export function pollKey(wallet: string, pollId: string): string {
  return `${wallet.toLowerCase()}::${pollId}`;
}

export function parsePollKey(key: string): {
  wallet: string;
  pollId: string;
} {
  const idx = key.indexOf("::");
  if (idx === -1) return { wallet: key, pollId: "" };
  return { wallet: key.slice(0, idx), pollId: key.slice(idx + 2) };
}

export type PollAdminStore = {
  // Global config (persisted)
  rpcUrl: string;
  pollAddress: string;
  registryAddress: string;

  // Per-poll data map (persisted, keyed by wallet::pollId)
  addressDataMap: Record<string, AddressData>;
  // Tracks the active poll key per wallet (persisted)
  activePollKeys: Record<string, string>;

  // Transient (NOT persisted)
  walletAddress: string;
  walletChainId: string;
  notice: Notice | null;
  busyAction: BusyAction;
  isComputingRoot: boolean;

  // Actions
  setRpcUrl: (value: string) => void;
  setPollAddress: (value: string) => void;
  setRegistryAddress: (value: string) => void;
  setWalletIdentity: (address: string, chainId: string) => void;
  clearWalletIdentity: () => void;
  setAddressField: <K extends keyof AddressData>(
    key: K,
    value: AddressData[K],
  ) => void;
  setStatus: (status: PollStatus | null) => void;
  setNotice: (notice: Notice | null) => void;
  setBusyAction: (action: BusyAction) => void;
  setIsComputingRoot: (value: boolean) => void;
  appendEligibleAddresses: (addresses: string[]) => void;
  startNewPoll: () => string;
  switchPoll: (key: string) => void;
  findPollKey: (wallet: string, pollId: string) => string | null;
};

/** Get the active composite key for the current wallet. */
function getActiveKey(state: PollAdminStore): string | null {
  if (!state.walletAddress) return null;
  return state.activePollKeys[state.walletAddress] ?? null;
}

/** Get the active address's data (or defaults if no wallet / poll). */
function getActiveData(state: PollAdminStore): AddressData {
  const key = getActiveKey(state);
  if (!key) return DEFAULT_ADDRESS_DATA;
  return state.addressDataMap[key] ?? DEFAULT_ADDRESS_DATA;
}

/** Read the active poll's data. Exported for use in the hook via getState(). */
export function getActiveEntryFromState(state: PollAdminStore): AddressData | null {
  const key = getActiveKey(state);
  if (!key) return null;
  return state.addressDataMap[key] ?? null;
}

export const usePollAdminStore = create<PollAdminStore>()(
  persist(
    (set, get) => ({
      // Global config
      rpcUrl: DEFAULT_RPC_URL,
      pollAddress: DEFAULT_POLL_ADDRESS,
      registryAddress: DEFAULT_REGISTRY_ADDRESS,

      // Per-poll data map
      addressDataMap: {},
      activePollKeys: {},

      // Transient state
      walletAddress: "",
      walletChainId: "",
      notice: null,
      busyAction: "",
      isComputingRoot: false,

      // Actions
      setRpcUrl: (value) => set({ rpcUrl: value }),
      setPollAddress: (value) => set({ pollAddress: value }),
      setRegistryAddress: (value) => set({ registryAddress: value }),

      setWalletIdentity: (address, chainId) => {
        const normalizedAddress = address.toLowerCase();
        set({
          walletAddress: normalizedAddress,
          walletChainId: chainId,
        });
      },

      clearWalletIdentity: () => {
        set({ walletAddress: "", walletChainId: "" });
      },

      setAddressField: (key, value) => {
        const state = get();
        const activeKey = getActiveKey(state);
        if (!activeKey) return;
        const existing =
          state.addressDataMap[activeKey] ?? createDefaultAddressData();
        set({
          addressDataMap: {
            ...state.addressDataMap,
            [activeKey]: { ...existing, [key]: value },
          },
        });
      },

      setStatus: (status) => {
        const state = get();
        const activeKey = getActiveKey(state);
        if (!activeKey) return;
        const existing =
          state.addressDataMap[activeKey] ?? createDefaultAddressData();
        set({
          addressDataMap: {
            ...state.addressDataMap,
            [activeKey]: { ...existing, status },
          },
        });
      },

      setNotice: (notice) => set({ notice }),
      setBusyAction: (action) => set({ busyAction: action }),
      setIsComputingRoot: (value) => set({ isComputingRoot: value }),

      appendEligibleAddresses: (addresses) => {
        const state = get();
        const activeKey = getActiveKey(state);
        if (!activeKey) return;
        const existing =
          state.addressDataMap[activeKey] ?? createDefaultAddressData();
        const current = new Set(existing.eligibleAddresses);
        const deduped = addresses.filter((a) => !current.has(a));
        if (deduped.length === 0) return;
        set({
          addressDataMap: {
            ...state.addressDataMap,
            [activeKey]: {
              ...existing,
              eligibleAddresses: [...existing.eligibleAddresses, ...deduped],
            },
          },
        });
      },

      startNewPoll: () => {
        const state = get();
        if (!state.walletAddress) return "";
        const newData = createDefaultAddressData();
        const key = pollKey(state.walletAddress, newData.pollIdInput);
        set({
          addressDataMap: {
            ...state.addressDataMap,
            [key]: newData,
          },
          activePollKeys: {
            ...state.activePollKeys,
            [state.walletAddress]: key,
          },
        });
        return newData.pollIdInput;
      },

      switchPoll: (key) => {
        const state = get();
        if (!state.walletAddress) return;
        if (!state.addressDataMap[key]) return;
        set({
          activePollKeys: {
            ...state.activePollKeys,
            [state.walletAddress]: key,
          },
        });
      },

      findPollKey: (wallet, pollId) => {
        const state = get();
        const key = pollKey(wallet.toLowerCase(), pollId);
        return state.addressDataMap[key] ? key : null;
      },
    }),
    {
      name: "starkvote-poll-admin",
      version: 3,
      migrate: (persisted, version) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let state = persisted as any;

        if (version === 0) {
          // Migrate from wallet-address-keyed to composite-keyed map
          const old = state as {
            addressDataMap?: Record<string, AddressData>;
          };
          const newMap: Record<string, AddressData> = {};
          const activePollKeys: Record<string, string> = {};

          if (old.addressDataMap) {
            for (const [walletAddr, data] of Object.entries(
              old.addressDataMap,
            )) {
              if (!data || !data.pollIdInput) continue;
              const key = pollKey(walletAddr, data.pollIdInput);
              newMap[key] = data;
              activePollKeys[walletAddr] = key;
            }
          }

          state = {
            ...state,
            addressDataMap: newMap,
            activePollKeys,
          };
        }

        if (version < 2) {
          // Migrate eligibleCount -> eligibleAddresses
          const map = (state.addressDataMap ?? {}) as Record<string, Record<string, unknown>>;
          const patched: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(map)) {
            const { eligibleCount: _removed, ...rest } = v as Record<string, unknown>;
            patched[k] = { ...rest, eligibleAddresses: (v as Record<string, unknown>).eligibleAddresses ?? [] };
          }
          state = { ...state, addressDataMap: patched };
        }

        if (version < 3) {
          // Normalize wallet keys to lowercase for consistent lookups
          const oldMap = (state.addressDataMap ?? {}) as Record<string, AddressData>;
          const newMap: Record<string, AddressData> = {};
          for (const [k, v] of Object.entries(oldMap)) {
            newMap[k.toLowerCase()] = v;
          }
          const oldActive = (state.activePollKeys ?? {}) as Record<string, string>;
          const newActive: Record<string, string> = {};
          for (const [wallet, key] of Object.entries(oldActive)) {
            newActive[wallet.toLowerCase()] = key.toLowerCase();
          }
          state = { ...state, addressDataMap: newMap, activePollKeys: newActive };
        }

        return state as object;
      },
      partialize: (state) => ({
        rpcUrl: state.rpcUrl,
        pollAddress: state.pollAddress,
        registryAddress: state.registryAddress,
        addressDataMap: state.addressDataMap,
        activePollKeys: state.activePollKeys,
      }),
    },
  ),
);

/** Read the active address's data from the store (reactive selector). */
export function useActiveAddressData(): AddressData {
  return usePollAdminStore((state) => getActiveData(state));
}

/** Read the active poll's composite key (reactive selector). */
export function useActivePollKey(): string | null {
  return usePollAdminStore((state) => getActiveKey(state));
}
