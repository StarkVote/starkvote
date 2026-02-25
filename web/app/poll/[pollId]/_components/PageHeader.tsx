import Link from "next/link";

type PageHeaderProps = {
  pollIdParam: string;
  pollAddress: string;
  registryAddress: string;
};

export function PageHeader({
  pollIdParam,
  pollAddress,
  registryAddress,
}: PageHeaderProps) {
  return (
    <div className="rounded-3xl border border-sky-200/20 bg-slate-900/70 p-6 shadow-2xl backdrop-blur">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-sky-200/80">StarkVote</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Poll {pollIdParam}</h1>
          <p className="mt-2 text-sm text-slate-300">
            Register your commitment and submit a ZK vote for this poll.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-full border border-slate-500/50 px-4 text-sm text-slate-100 transition hover:border-slate-300"
        >
          Choose another poll
        </Link>
      </div>

      <div className="mt-6 grid gap-3 text-xs text-slate-300 md:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
          <p className="uppercase tracking-wide text-slate-400">Poll contract</p>
          <p className="mt-1 font-mono text-slate-100">{pollAddress}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
          <p className="uppercase tracking-wide text-slate-400">Registry contract</p>
          <p className="mt-1 font-mono text-slate-100">{registryAddress}</p>
        </div>
      </div>
    </div>
  );
}
