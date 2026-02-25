import { PRIMARY_BUTTON_CLASS } from "../../constants";

type StepConnectWalletProps = {
  isWalletConnected: boolean;
  walletAddress: string;
  isBusy: boolean;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
};

export function StepConnectWallet({
  isWalletConnected,
  isBusy,
  onConnect,
}: StepConnectWalletProps) {
  if (isWalletConnected) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-5 py-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04]">
        <svg className="h-6 w-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
        </svg>
      </div>
      <p className="text-sm text-slate-500">Connect your Starknet wallet to begin</p>
      <button
        type="button"
        className={PRIMARY_BUTTON_CLASS}
        onClick={() => void onConnect()}
        disabled={isBusy}
      >
        Connect Wallet
      </button>
    </div>
  );
}
