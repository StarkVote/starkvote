import { useCallback, useMemo, useRef, useState } from "react";
import { normalizeHex } from "@/lib/starkvote";
import { SECONDARY_BUTTON_CLASS } from "../../constants";
import { truncateAddress } from "../../utils";

const ADDRESS_RE = /^0x[0-9a-fA-F]{1,64}$/;

type StepAddEligibleProps = {
  eligibleInput: string;
  eligibleAddresses: string[];
  registeredVoters: Set<string>;
  walletAddress: string;
  pollId: string;
  leafCount: number;
  isFrozen: boolean;
  busyAction: string;
  isBusy: boolean;
  isWalletConnected: boolean;
  onEligibleInputChange: (value: string) => void;
  onAddEligibleBatch: () => Promise<void>;
  onFreezeRegistry: () => Promise<void>;
};

/** Split raw text into unique, validated address chips. */
function parseChips(
  raw: string,
  existingSet: Set<string>,
  adminAddress: string,
): { address: string; normalized: string }[] {
  const tokens = raw.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
  const seen = new Set<string>();
  const chips: { address: string; normalized: string }[] = [];

  for (const token of tokens) {
    const normalized = normalizeHex(token);
    if (!ADDRESS_RE.test(normalized)) continue;
    const lower = normalized.toLowerCase();
    if (seen.has(lower)) continue;
    if (existingSet.has(normalized)) continue;
    if (adminAddress && lower === adminAddress.toLowerCase()) continue;
    seen.add(lower);
    chips.push({ address: token, normalized });
  }
  return chips;
}

export function StepAddEligible({
  eligibleInput,
  eligibleAddresses,
  registeredVoters,
  walletAddress,
  pollId,
  leafCount,
  isFrozen,
  busyAction,
  isBusy,
  isWalletConnected,
  onEligibleInputChange,
  onAddEligibleBatch,
  onFreezeRegistry,
}: StepAddEligibleProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [validationMsg, setValidationMsg] = useState("");
  const validationTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const [freezeConfirm, setFreezeConfirm] = useState<{ unregistered: number } | null>(null);

  const shareUrl =
    typeof window !== "undefined" && pollId
      ? `${window.location.origin}/poll/${pollId}`
      : "";

  const copyLink = useCallback(() => {
    if (!shareUrl) return;
    void navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [shareUrl]);

  const showValidation = useCallback((msg: string) => {
    setValidationMsg(msg);
    if (validationTimer.current) clearTimeout(validationTimer.current);
    validationTimer.current = setTimeout(() => setValidationMsg(""), 3000);
  }, []);

  const registeredSet = useMemo(
    () => new Set(eligibleAddresses),
    [eligibleAddresses],
  );

  // Pending chips from current input
  const pendingChips = useMemo(
    () => parseChips(eligibleInput, registeredSet, walletAddress),
    [eligibleInput, registeredSet, walletAddress],
  );

  // Set of all known addresses (eligible + pending) for duplicate checking
  const allKnownLower = useMemo(() => {
    const s = new Set<string>();
    for (const a of eligibleAddresses) s.add(a.toLowerCase());
    for (const c of pendingChips) s.add(c.normalized.toLowerCase());
    if (walletAddress) s.add(walletAddress.toLowerCase());
    return s;
  }, [eligibleAddresses, pendingChips, walletAddress]);

  /** Validate a single address. Returns an error message or null. */
  const validateAddress = useCallback(
    (raw: string): string | null => {
      const normalized = normalizeHex(raw.trim());
      if (!ADDRESS_RE.test(normalized)) return null; // not a complete address yet
      if (walletAddress && normalized.toLowerCase() === walletAddress.toLowerCase()) {
        return "Admin address is added automatically";
      }
      if (allKnownLower.has(normalized.toLowerCase())) {
        return "Address already added";
      }
      return null;
    },
    [walletAddress, allKnownLower],
  );

  const adminInEligible = useMemo(
    () =>
      Boolean(
        walletAddress &&
        eligibleAddresses.some(
          (a) => a.toLowerCase() === walletAddress.toLowerCase(),
        ),
      ),
    [walletAddress, eligibleAddresses],
  );

  // Remove a pending chip by index
  const removeChip = useCallback(
    (index: number) => {
      const tokens = eligibleInput
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean);

      // Build a mapping from chip index → token index
      const existingLower = new Set(
        eligibleAddresses.map((a) => a.toLowerCase()),
      );
      const adminLower = walletAddress.toLowerCase();
      const seen = new Set<string>();
      let chipIdx = 0;
      let tokenToRemove = -1;

      for (let ti = 0; ti < tokens.length; ti++) {
        const normalized = normalizeHex(tokens[ti]);
        if (!ADDRESS_RE.test(normalized)) continue;
        const lower = normalized.toLowerCase();
        if (seen.has(lower) || existingLower.has(lower)) continue;
        if (walletAddress && lower === adminLower) continue;
        seen.add(lower);
        if (chipIdx === index) {
          tokenToRemove = ti;
          break;
        }
        chipIdx++;
      }

      if (tokenToRemove >= 0) {
        tokens.splice(tokenToRemove, 1);
        onEligibleInputChange(tokens.join(" "));
      }
    },
    [eligibleInput, eligibleAddresses, walletAddress, onEligibleInputChange],
  );

  // Handle paste: intercept and convert to space-separated
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pasted = e.clipboardData.getData("text");
      // If multi-address paste, prevent default and append
      if (/[\s,]/.test(pasted.trim())) {
        e.preventDefault();
        const current = eligibleInput.trim();
        onEligibleInputChange(current ? `${current} ${pasted}` : pasted);
        // Clear the input field value after paste
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [eligibleInput, onEligibleInputChange],
  );

  // Handle typing in the input — on Enter or space, append
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const value = (e.target as HTMLInputElement).value.trim();
      if ((e.key === "Enter" || e.key === " ") && value) {
        e.preventDefault();
        const current = eligibleInput.trim();
        onEligibleInputChange(current ? `${current} ${value}` : value);
        (e.target as HTMLInputElement).value = "";
      }
      // Backspace on empty input removes last chip
      if (e.key === "Backspace" && !value && pendingChips.length > 0) {
        removeChip(pendingChips.length - 1);
      }
    },
    [eligibleInput, onEligibleInputChange, pendingChips.length, removeChip],
  );

  const newCount = pendingChips.length;

  // Chip component
  const Chip = ({
    label,
    badges,
    onRemove,
    muted,
  }: {
    label: string;
    badges?: { text: string; className: string }[];
    onRemove?: () => void;
    muted?: boolean;
  }) => (
    <span
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-mono transition ${
        muted
          ? "border-white/[0.06] bg-white/[0.02] text-slate-500"
          : "border-white/[0.08] bg-white/[0.04] text-slate-300"
      }`}
    >
      <span className="truncate">{label}</span>
      {badges?.map((b) => (
        <span
          key={b.text}
          className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-medium font-sans ${b.className}`}
        >
          {b.text}
        </span>
      ))}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 shrink-0 cursor-pointer rounded p-1 text-slate-500 transition hover:bg-white/[0.08] hover:text-red-400"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );

  const hasEligible = eligibleAddresses.length > 0 || (walletAddress && adminInEligible);

  return (
    <div className="flex flex-col gap-4">
      {/* Eligible addresses (already on-chain) */}
      {hasEligible && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
            On-chain ({eligibleAddresses.length})
          </span>
          <div className="flex flex-wrap gap-2">
            {/* Admin chip */}
            {walletAddress && adminInEligible && (
              <Chip
                label={truncateAddress(walletAddress)}
                badges={[
                  { text: "admin", className: "bg-[#633CFF]/15 text-[#a78bfa]" },
                  ...(registeredVoters.has(walletAddress)
                    ? [{ text: "registered", className: "bg-emerald-500/15 text-emerald-400" }]
                    : [{ text: "eligible", className: "bg-emerald-500/15 text-emerald-400/70" }]),
                ]}
              />
            )}

            {/* Other eligible address chips */}
            {eligibleAddresses.map((addr) => {
              const isAdmin =
                walletAddress && addr.toLowerCase() === walletAddress.toLowerCase();
              if (isAdmin) return null;
              const hasReg = registeredVoters.has(addr);
              return (
                <Chip
                  key={addr}
                  label={truncateAddress(addr)}
                  muted={hasReg}
                  badges={
                    hasReg
                      ? [{ text: "registered", className: "bg-emerald-500/15 text-emerald-400" }]
                      : [{ text: "eligible", className: "bg-emerald-500/15 text-emerald-400/70" }]
                  }
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Tag-input container for pending / new addresses */}
      {!isFrozen && (
        <div
          className={`flex min-h-[120px] flex-col rounded-xl border bg-white/[0.05] transition ${
            validationMsg
              ? "border-amber-500/50 ring-1 ring-amber-500/25"
              : "border-white/[0.08] focus-within:border-[#633CFF]/50 focus-within:ring-1 focus-within:ring-[#633CFF]/25"
          }`}
          onClick={() => inputRef.current?.focus()}
        >
          {/* Pending chips + input */}
          <div className="flex flex-1 flex-wrap items-start gap-2 p-3">
            {/* Admin chip shown here only if not yet eligible */}
            {walletAddress && !adminInEligible && (
              <Chip
                label={truncateAddress(walletAddress)}
                badges={[
                  { text: "admin", className: "bg-[#633CFF]/15 text-[#a78bfa]" },
                ]}
              />
            )}

            {/* Pending new chips from input */}
            {pendingChips.map((chip, i) => (
              <Chip
                key={chip.normalized}
                label={truncateAddress(chip.normalized)}
                badges={[{ text: "new", className: "bg-[#633CFF]/15 text-[#a78bfa]/70" }]}
                onRemove={() => removeChip(i)}
              />
            ))}

            {/* Inline text input */}
            <input
              ref={inputRef}
              type="text"
              className="min-w-[200px] flex-1 bg-transparent py-2 text-base text-slate-100 placeholder:text-slate-500 outline-none"
              placeholder={
                pendingChips.length === 0 && !walletAddress
                  ? "Paste or type wallet addresses"
                  : "Add more addresses..."
              }
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              onChange={(e) => {
                const val = e.target.value;
                const trimmed = val.trim();

                // Multi-address paste/type with separators
                if (/[\s,]/.test(trimmed) && trimmed.length > 2) {
                  const tokens = trimmed.split(/[\s,]+/).filter(Boolean);
                  let dupeCount = 0;
                  for (const t of tokens) {
                    const msg = validateAddress(t);
                    if (msg) dupeCount++;
                  }
                  if (dupeCount > 0) {
                    showValidation(`${dupeCount} duplicate address${dupeCount > 1 ? "es" : ""} skipped`);
                  }
                  const current = eligibleInput.trim();
                  onEligibleInputChange(current ? `${current} ${trimmed}` : trimmed);
                  e.target.value = "";
                  return;
                }

                // Single address — auto-add if valid
                const normalized = normalizeHex(trimmed);
                if (ADDRESS_RE.test(normalized) && normalized.length >= 5) {
                  const msg = validateAddress(trimmed);
                  if (msg) {
                    showValidation(msg);
                    e.target.value = "";
                    return;
                  }
                  const current = eligibleInput.trim();
                  onEligibleInputChange(current ? `${current} ${trimmed}` : trimmed);
                  e.target.value = "";
                }
              }}
            />
          </div>

          {/* Bottom bar: validation + submit */}
          <div className="flex items-center justify-between border-t border-white/[0.06] px-3 py-2">
            <span className="text-xs text-slate-500">
              {validationMsg || (
                newCount > 0 ? (
                  <span className="text-[#a78bfa]">{newCount + (adminInEligible ? 0 : walletAddress ? 1 : 0)} to whitelist</span>
                ) : (
                  "Paste addresses above"
                )
              )}
            </span>
            <button
              type="button"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-[#633CFF]/80 px-3 text-xs font-medium text-white transition hover:bg-[#633CFF] disabled:cursor-not-allowed disabled:opacity-30"
              onClick={() => void onAddEligibleBatch()}
              disabled={isBusy || !isWalletConnected || (newCount === 0 && adminInEligible)}
            >
              {busyAction === "add_eligible_batch" ? (
                "Submitting..."
              ) : (
                <>
                  Submit to chain
                  {(() => {
                    const total = newCount + (adminInEligible ? 0 : walletAddress ? 1 : 0);
                    return total > 0 ? ` (${total})` : "";
                  })()}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Secondary actions row */}
      <div className="flex items-center justify-between">
        {!isFrozen ? (
          <button
            type="button"
            className="group inline-flex cursor-pointer items-center gap-2 text-sm text-slate-500 transition hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => {
              const unregistered = eligibleAddresses.filter(
                (a) => !registeredVoters.has(a),
              ).length;
              if (unregistered > 0) {
                setFreezeConfirm({ unregistered });
              } else {
                void onFreezeRegistry();
              }
            }}
            disabled={isBusy || !isWalletConnected}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            {busyAction === "freeze" ? "Freezing..." : "Freeze registry"}
          </button>
        ) : (
          <span className="inline-flex items-center gap-2 text-sm text-emerald-400/70">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            Registry frozen
          </span>
        )}
        {shareUrl && (
          <button
            type="button"
            onClick={copyLink}
            title={shareUrl}
            className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-300"
          >
            {copied ? (
              <>
                <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                </svg>
                Copy poll link
              </>
            )}
          </button>
        )}
      </div>

      {/* Freeze confirmation modal */}
      {freezeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#1a1035] p-8 shadow-2xl">
            <div className="mb-2 flex items-center gap-2.5">
              <svg className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <h3 className="text-base font-semibold text-white">Freeze registry?</h3>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              <span className="font-medium text-amber-400">
                {freezeConfirm.unregistered} of {eligibleAddresses.length}
              </span>{" "}
              eligible voter{freezeConfirm.unregistered !== 1 ? "s have" : " has"} not
              registered yet. Once frozen, no new voters can be added. Unregistered
              voters will not be able to participate.
            </p>
            <div className="mt-6 flex items-center justify-end gap-4">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => setFreezeConfirm(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex h-12 cursor-pointer items-center justify-center rounded-xl bg-amber-500/90 px-6 text-base font-medium text-black transition hover:bg-amber-400"
                onClick={() => {
                  setFreezeConfirm(null);
                  void onFreezeRegistry();
                }}
              >
                Freeze Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
