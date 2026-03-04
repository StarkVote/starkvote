"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePollAdminStore, parsePollKey } from "../store";
import { usePollAdminWizard } from "../hooks/use-poll-admin-wizard";
import { getLifecycle, getMaxUnlockedStep, isConnectedWalletPollAdmin } from "../utils";
import { CARD_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "../constants";
import { StarkVoteLogo } from "@/components/starkvote-logo";
import { TopNav } from "@/components/top-nav";

type PollEntry = {
  compositeKey: string;
  pollId: string;
  lifecycle: { label: string; tone: string };
  maxStep: number;
  eligibleCount: number;
  isAdmin: boolean;
  questionText?: string;
};

function useWalletPolls(wallet: string): PollEntry[] {
  const addressDataMap = usePollAdminStore((s) => s.addressDataMap);
  if (!wallet) return [];

  const polls: PollEntry[] = [];
  for (const [compositeKey, data] of Object.entries(addressDataMap)) {
    if (!data.pollIdInput) continue;
    const { wallet: w } = parsePollKey(compositeKey);
    if (w.toLowerCase() !== wallet.toLowerCase()) continue;
    polls.push({
      compositeKey,
      pollId: data.pollIdInput,
      lifecycle: getLifecycle(data.status),
      maxStep: getMaxUnlockedStep(true, data.status),
      eligibleCount: (data.eligibleAddresses ?? []).length,
      isAdmin: isConnectedWalletPollAdmin(data.status, wallet),
    });
  }
  return polls;
}

function truncateAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function PollListPage() {
  const router = useRouter();
  const wizard = usePollAdminWizard();
  const polls = useWalletPolls(wizard.walletAddress);

  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Fetch question texts for existing polls
  const [questionMap, setQuestionMap] = useState<Record<string, string>>({});
  useEffect(() => {
    if (polls.length === 0) return;
    let cancelled = false;
    const fetchQuestions = async () => {
      const map: Record<string, string> = {};
      await Promise.all(
        polls.map(async (poll) => {
          try {
            const res = await fetch(`/api/questions?pollId=${poll.pollId}`);
            if (res.ok) {
              const data = await res.json();
              if (data.question) map[poll.pollId] = data.question;
            }
          } catch { /* ignore */ }
        }),
      );
      if (!cancelled) setQuestionMap(map);
    };
    void fetchQuestions();
    return () => { cancelled = true; };
  }, [polls.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewPoll = () => {
    setQuestionText("");
    setShowQuestionModal(true);
  };

  const handleCreatePoll = useCallback(async () => {
    if (!questionText.trim()) return;
    setIsCreating(true);
    try {
      const newPollId = usePollAdminStore.getState().startNewPoll();
      if (!newPollId) return;
      await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId: newPollId, question: questionText.trim() }),
      });
      setShowQuestionModal(false);
      router.push(`/admin/poll/${newPollId}`);
    } finally {
      setIsCreating(false);
    }
  }, [questionText, router]);

  const handleSelectPoll = (pollId: string) => {
    router.push(`/admin/poll/${pollId}`);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a12]">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(99,60,255,0.12)_0%,transparent_60%),radial-gradient(ellipse_at_80%_70%,rgba(0,200,255,0.06)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(1px_1px_at_20%_30%,rgba(255,255,255,0.15),transparent),radial-gradient(1px_1px_at_40%_70%,rgba(255,255,255,0.1),transparent),radial-gradient(1px_1px_at_60%_20%,rgba(255,255,255,0.12),transparent),radial-gradient(1px_1px_at_80%_50%,rgba(255,255,255,0.08),transparent)]" />
      </div>

      <TopNav>
        {wizard.isWalletConnected && (
          <div className="flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.05] px-4 py-2 text-sm text-slate-300 backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {truncateAddress(wizard.walletAddress)}
            <button
              type="button"
              onClick={() => void wizard.disconnectWallet()}
              disabled={wizard.isBusy}
              className="ml-1 text-slate-500 transition hover:text-red-400 disabled:opacity-40"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        )}
      </TopNav>

      {/* Hero section */}
      <div className="relative z-10 flex flex-col items-center px-6 pt-12 pb-16">
        <div className="animate-fade-up">
          <StarkVoteLogo size={120} />
        </div>

        <h1 className="animate-fade-up-delay mt-8 font-[family-name:var(--font-heading)] text-5xl font-bold tracking-tight md:text-6xl">
          <span className="bg-gradient-to-br from-white via-[#c4b5fd] to-[#818cf8] bg-clip-text text-transparent">
            StarkVote
          </span>
        </h1>

        <p className="animate-fade-up-delay-2 mt-3 text-sm font-medium uppercase tracking-[0.25em] text-[#a78bfa]/60">
          Anonymous On-Chain Voting
        </p>

        {/* Feature pills */}
        <div className="animate-fade-in mt-8 flex flex-wrap justify-center gap-3">
          {["ZK-Proof Privacy", "Starknet L2", "Verifiable Results"].map((feature) => (
            <span
              key={feature}
              className="rounded-full border border-[#633CFF]/20 bg-[#633CFF]/[0.08] px-4 py-1.5 text-xs font-medium text-[#a78bfa]"
            >
              {feature}
            </span>
          ))}
        </div>
      </div>

      {/* Main content */}
      <main className="relative z-10 mx-auto max-w-2xl px-6 pb-20">
        {!wizard.isWalletConnected ? (
          <div className="animate-fade-up-delay-2 flex flex-col items-center gap-4">
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => void wizard.connectWallet()}
              disabled={wizard.isBusy}
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <section className={`${CARD_CLASS} animate-fade-up-delay-2`}>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-white">
                  Your Polls
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Manage your on-chain voting polls
                </p>
              </div>
              <button
                type="button"
                onClick={handleNewPoll}
                className={PRIMARY_BUTTON_CLASS + " !h-9 !px-4 !text-sm"}
              >
                <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New Poll
              </button>
            </div>

            {polls.length === 0 ? (
              <div className="flex flex-col items-center gap-6 py-16 text-center">
                {/* Decorative icon cluster */}
                <div className="relative">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[#633CFF]/15 bg-gradient-to-br from-[#633CFF]/10 to-[#4f46e5]/5">
                    <svg className="h-9 w-9 text-[#a78bfa]/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
                    </svg>
                  </div>
                  <div className="absolute -right-1.5 -bottom-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-[#633CFF]/20 bg-[#1a1035] shadow-lg">
                    <svg className="h-3.5 w-3.5 text-[#a78bfa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                </div>

                <div className="max-w-xs">
                  <p className="text-base font-semibold text-slate-200">No polls yet</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    Create your first anonymous on-chain poll. Set up eligible voters, configure options, and launch — all powered by zero-knowledge proofs.
                  </p>
                </div>

                {/* Feature highlights */}
                <div className="mt-1 flex flex-wrap justify-center gap-2">
                  {["Private voting", "On-chain results", "ZK verified"].map((tag) => (
                    <span key={tag} className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-slate-500">
                      {tag}
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleNewPoll}
                  className={PRIMARY_BUTTON_CLASS + " mt-2 !h-11 !px-6 !text-sm"}
                >
                  <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Create Your First Poll
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {polls.map((poll) => (
                  <button
                    key={poll.compositeKey}
                    type="button"
                    onClick={() => handleSelectPoll(poll.pollId)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 text-left transition hover:border-[#633CFF]/20 hover:bg-[#633CFF]/[0.04]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] transition group-hover:border-[#633CFF]/20 group-hover:bg-[#633CFF]/[0.06]">
                      <svg className="h-4.5 w-4.5 text-slate-500 transition group-hover:text-[#a78bfa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-200">
                        {questionMap[poll.pollId] || `Poll #${poll.pollId}`}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {questionMap[poll.pollId] ? `#${poll.pollId} · ` : ""}
                        {poll.eligibleCount} eligible voter{poll.eligibleCount !== 1 ? "s" : ""}
                        {poll.isAdmin ? " \u00B7 Admin" : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${poll.lifecycle.tone}`}
                    >
                      {poll.lifecycle.label}
                    </span>
                    <svg className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-[#a78bfa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Question Modal */}
      {showQuestionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className={`${CARD_CLASS} w-full max-w-md mx-4`}>
            <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-white">
              New Poll
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Enter the question voters will answer.
            </p>
            <input
              type="text"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && questionText.trim() && !isCreating) {
                  void handleCreatePoll();
                }
              }}
              placeholder="e.g. Who should be the next president?"
              className={`${INPUT_CLASS} mt-4`}
              autoFocus
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowQuestionModal(false)}
                disabled={isCreating}
                className={SECONDARY_BUTTON_CLASS + " !h-10 !px-5 !text-sm"}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreatePoll()}
                disabled={!questionText.trim() || isCreating}
                className={PRIMARY_BUTTON_CLASS + " !h-10 !px-5 !text-sm"}
              >
                {isCreating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}

    </div>
  );
}
