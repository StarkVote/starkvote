declare module "snarkjs" {
  export const groth16: {
    fullProve: (
      input: Record<string, unknown>,
      wasmFile: string,
      zkeyFileName: string,
    ) => Promise<{ proof: unknown; publicSignals: Array<string | bigint> }>;
  };
}
