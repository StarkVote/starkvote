import { Identity } from "@semaphore-protocol/identity";

import type { GeneratedIdentity } from "./types";

export function generateIdentityData(): GeneratedIdentity {
  const identity = new Identity();
  return {
    serialized: identity.export(),
    secretScalar: identity.secretScalar.toString(),
    commitment: identity.commitment.toString(),
  };
}

export function toIdentityJson(identity: GeneratedIdentity): string {
  return JSON.stringify(
    {
      serialized: identity.serialized,
      secret_scalar: identity.secretScalar,
      commitment: identity.commitment,
    },
    null,
    2,
  );
}
