import {
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../constants";

type StepConnectWalletProps = {
  rpcUrl: string;
  pollAddress: string;
  registryAddress: string;
  pollIdInput: string;
  isWalletConnected: boolean;
  walletAddress: string;
  walletChainId: string;
  isBusy: boolean;
  onRpcUrlChange: (value: string) => void;
  onPollAddressChange: (value: string) => void;
  onRegistryAddressChange: (value: string) => void;
  onPollIdChange: (value: string) => void;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
};

export function StepConnectWallet({
  rpcUrl,
  pollAddress,
  registryAddress,
  pollIdInput,
  isWalletConnected,
  walletAddress,
  walletChainId,
  isBusy,
  onRpcUrlChange,
  onPollAddressChange,
  onRegistryAddressChange,
  onPollIdChange,
  onConnect,
  onDisconnect,
}: StepConnectWalletProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-950">Step 1: Connect wallet</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Set RPC/contracts and connect your Starknet wallet. This unlocks on-chain admin actions.
      </p>

      <div className="mt-5 grid gap-4">
        <label className="block text-sm font-medium text-zinc-700">
          RPC URL
          <input
            className={INPUT_CLASS}
            value={rpcUrl}
            onChange={(event) => onRpcUrlChange(event.target.value)}
            placeholder="https://rpc.starknet-..."
          />
        </label>

        <label className="block text-sm font-medium text-zinc-700">
          Poll contract
          <input
            className={INPUT_CLASS}
            value={pollAddress}
            onChange={(event) => onPollAddressChange(event.target.value)}
            placeholder="0x..."
          />
        </label>

        <label className="block text-sm font-medium text-zinc-700">
          Registry contract
          <input
            className={INPUT_CLASS}
            value={registryAddress}
            onChange={(event) => onRegistryAddressChange(event.target.value)}
            placeholder="0x..."
          />
        </label>

        <label className="block text-sm font-medium text-zinc-700">
          Poll ID
          <input
            className={INPUT_CLASS}
            value={pollIdInput}
            onChange={(event) => onPollIdChange(event.target.value)}
            placeholder="1"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {isWalletConnected ? (
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => void onDisconnect()}
            disabled={isBusy}
          >
            Disconnect Wallet
          </button>
        ) : (
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => void onConnect()}
            disabled={isBusy}
          >
            Connect Wallet
          </button>
        )}
        <span className="text-sm text-zinc-600">
          {isWalletConnected ? walletAddress : "No wallet connected"}
        </span>
      </div>
      {walletChainId ? <p className="mt-2 text-xs text-zinc-500">Chain ID: {walletChainId}</p> : null}
    </div>
  );
}
