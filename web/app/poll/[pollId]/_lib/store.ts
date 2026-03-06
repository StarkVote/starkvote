import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { GeneratedIdentity } from "./types";

export type PollVoterData = {
  currentStep: number;
  selectedOption: number | null;
  identityInput: string;
  generatedIdentity: GeneratedIdentity | null;
  registerTx: string | null;
  voteTx: string | null;
};

const DEFAULT_VOTER_DATA: PollVoterData = {
  currentStep: 1,
  selectedOption: null,
  identityInput: "",
  generatedIdentity: null,
  registerTx: null,
  voteTx: null,
};

type PollVoterStore = {
  polls: Record<string, PollVoterData>;

  setField: <K extends keyof PollVoterData>(
    pollId: string,
    key: K,
    value: PollVoterData[K],
  ) => void;
};

export const usePollVoterStore = create<PollVoterStore>()(
  persist(
    (set, get) => ({
      polls: {},

      setField: (pollId, key, value) => {
        const state = get();
        set({
          polls: {
            ...state.polls,
            [pollId]: {
              ...(state.polls[pollId] ?? DEFAULT_VOTER_DATA),
              [key]: value,
            },
          },
        });
      },
    }),
    {
      name: "starkvote-poll-voter",
      version: 1,
      storage: {
        getItem: (name) => {
          const value = sessionStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: (name, value) => {
          sessionStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          sessionStorage.removeItem(name);
        },
      },
    },
  ),
);

/** Reactive selector for a single poll's voter data. */
export function usePollVoterData(pollId: string): PollVoterData {
  return usePollVoterStore(
    (state) => state.polls[pollId] ?? DEFAULT_VOTER_DATA,
  );
}

/** Convenience hook returning stable setter callbacks scoped to a poll. */
export function usePollVoterActions(pollId: string) {
  const setField = usePollVoterStore((s) => s.setField);

  return useMemo(
    () => ({
      setCurrentStep: (step: number) =>
        setField(pollId, "currentStep", step),
      setSelectedOption: (option: number | null) =>
        setField(pollId, "selectedOption", option),
      setIdentityInput: (input: string) =>
        setField(pollId, "identityInput", input),
      setGeneratedIdentity: (identity: GeneratedIdentity | null) =>
        setField(pollId, "generatedIdentity", identity),
      setRegisterTx: (tx: string | null) =>
        setField(pollId, "registerTx", tx),
      setVoteTx: (tx: string | null) =>
        setField(pollId, "voteTx", tx),
    }),
    [pollId, setField],
  );
}
