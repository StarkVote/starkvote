export type Notice = {
  type: "success" | "error" | "info";
  message: string;
};

export type Tally = {
  option: number;
  votes: number;
};

export type PollStatus = {
  pollId: number;
  exists: boolean;
  optionsCount: number;
  optionLabels: string[];
  startTime: number;
  endTime: number;
  snapshotRoot: string;
  finalized: boolean;
  winnerOption: number;
  maxVotes: number;
  frozen: boolean;
  leafCount: number;
  pollAdmin: string;
  tallies: Tally[];
};

export type LifecycleBadge = {
  label: string;
  tone: string;
};

export type RegistryReadContract = {
  is_frozen: (pollId: number) => Promise<unknown>;
  is_eligible: (pollId: number, address: string) => Promise<unknown>;
  has_registered: (pollId: number, address: string) => Promise<unknown>;
  get_leaf_count: (pollId: number) => Promise<unknown>;
  get_leaf: (pollId: number, index: number) => Promise<unknown>;
  get_poll_admin: (pollId: number) => Promise<unknown>;
};

export type RegistryWriteContract = RegistryReadContract & {
  add_eligible_batch: (
    pollId: number,
    addresses: string[],
  ) => Promise<{ transaction_hash: string }>;
  freeze: (pollId: number) => Promise<{ transaction_hash: string }>;
};

export type PollReadContract = {
  get_poll: (pollId: number) => Promise<Record<string, unknown>>;
  get_tally: (pollId: number, option: number) => Promise<unknown>;
  get_option_labels: (pollId: number) => Promise<unknown>;
};

export type PollWriteContract = PollReadContract & {
  create_poll: (
    pollId: number,
    optionsCount: number,
    startTime: number,
    endTime: number,
    merkleRoot: { low: string; high: string },
    optionLabels: string[],
  ) => Promise<{ transaction_hash: string }>;
  finalize: (pollId: number) => Promise<{ transaction_hash: string }>;
};

export type BusyAction =
  | ""
  | "add_eligible_batch"
  | "freeze"
  | "create_poll"
  | "finalize";

export type AddressData = {
  pollIdInput: string;
  eligibleInput: string;
  optionsCountInput: string;
  durationInput: string;
  merkleRootInput: string;
  optionLabelsInput: string;
  currentStep: number;
  lastTxHash: string;
  eligibleAddresses: string[];
  status: PollStatus | null;
};
