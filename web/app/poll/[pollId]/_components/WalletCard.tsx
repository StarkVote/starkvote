import { formatShortHash } from "../_lib/utils";

type WalletCardProps = {
  connected: boolean;
  walletName: string;
  accountAddress: string | null;
  connectingWallet: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
};

export function WalletCard({
  connected,
  walletName,
  accountAddress,
  connectingWallet,
  onConnect,
  onDisconnect,
}: WalletCardProps) {
  return (
    <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
      <h2 className="text-sm uppercase tracking-[0.2em] text-slate-300">Wallet</h2>
      <p className="mt-3 text-sm text-slate-400">
        {connected
          ? `${walletName} · ${formatShortHash(accountAddress)}`
          : "Connect to register and vote."}
      </p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onConnect}
          disabled={connectingWallet}
          className="inline-flex h-10 items-center justify-center rounded-full bg-sky-400 px-4 text-sm font-semibold text-slate-900 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {connectingWallet ? "Connecting..." : "Connect wallet"}
        </button>
        {connected ? (
          <button
            type="button"
            onClick={onDisconnect}
            className="inline-flex h-10 items-center justify-center rounded-full border border-slate-500 px-4 text-sm text-slate-100 transition hover:border-slate-200"
          >
            Disconnect
          </button>
        ) : null}
      </div>
    </article>
  );
}
