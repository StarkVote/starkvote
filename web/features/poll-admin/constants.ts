export const CARD_CLASS =
  "rounded-2xl border border-zinc-200/80 bg-white/90 p-6 shadow-[0_1px_0_rgba(0,0,0,0.03),0_18px_40px_-28px_rgba(0,0,0,0.35)]";

export const INPUT_CLASS =
  "mt-2 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200";

export const TEXTAREA_CLASS =
  "mt-2 min-h-[120px] w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200";

export const PRIMARY_BUTTON_CLASS =
  "inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60";

export const SECONDARY_BUTTON_CLASS =
  "inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60";

export const WIZARD_STEPS = [
  { id: 1, label: "Connect Wallet", hint: "Attach admin account" },
  { id: 2, label: "Add Eligible", hint: "Whitelist voters" },
  { id: 3, label: "Freeze Registry", hint: "Lock voter set" },
  { id: 4, label: "Create Poll", hint: "Publish poll data" },
  { id: 5, label: "Manage Poll", hint: "Review tallies/finalize" },
] as const;
