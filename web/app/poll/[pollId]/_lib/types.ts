export type PollDetails = {
  exists: boolean;
  optionsCount: number;
  startTime: number;
  endTime: number;
  snapshotRootHex: string;
  finalized: boolean;
  winnerOption: number;
  maxVotes: number;
};

export type ParsedVotePayload = {
  option?: number;
  payloadPollId?: bigint;
  proof: string[];
};

export type GeneratedIdentity = {
  serialized: string;
  secretScalar: string;
  commitment: string;
};

export type ImportedIdentity = {
  serialized: string;
  commitment?: string;
};

export type GeneratedProofPayload = {
  poll_id: string;
  option: number;
  leaf_index: number;
  leaf_count: number;
  full_proof_with_hints: string[];
  public_signals: string[];
};
