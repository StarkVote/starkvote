import { PRIMARY_BUTTON_CLASS } from "@/features/poll-admin/constants";

import { formatShortHash } from "../_lib/utils";

type StepConnectProps = {
  isConnected: boolean;
  walletName: string;
  accountAddress: string | null;
  connecting: boolean;
  onConnect: () => void;
  onContinue: () => void;
};

export function StepConnect({
  isConnected,
  walletName,
  accountAddress,
  connecting,
  onConnect,
  onContinue,
}: StepConnectProps) {
  if (isConnected) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3">
          <p className="text-sm text-slate-300">
            Connected as{" "}
            <span className="font-medium text-white">{walletName}</span>
          </p>
          <p className="mt-0.5 font-mono text-xs text-slate-500">
            {formatShortHash(accountAddress)}
          </p>
        </div>
        <button
          type="button"
          onClick={onContinue}
          className={`${PRIMARY_BUTTON_CLASS} w-full`}
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Connect your Starknet wallet to register and vote in this poll.
      </p>
      <button
        type="button"
        onClick={onConnect}
        disabled={connecting}
        className={`${PRIMARY_BUTTON_CLASS} w-full`}
      >
        {connecting ? "Connecting\u2026" : "Connect Wallet"}
      </button>
    </div>
  );
}
