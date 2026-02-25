export const CARD_CLASS =
  "rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset,0_20px_50px_-12px_rgba(0,0,0,0.5)]";

export const INPUT_CLASS =
  "h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-violet-500/50 focus:bg-white/[0.07] focus:ring-1 focus:ring-violet-500/25";

export const TEXTAREA_CLASS =
  "min-h-[120px] w-full rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-violet-500/50 focus:bg-white/[0.07] focus:ring-1 focus:ring-violet-500/25";

export const PRIMARY_BUTTON_CLASS =
  "inline-flex h-10 items-center justify-center rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-5 text-sm font-medium text-white shadow-[0_0_20px_-4px_rgba(139,92,246,0.5)] transition hover:from-violet-500 hover:to-indigo-500 hover:shadow-[0_0_24px_-4px_rgba(139,92,246,0.65)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none";

export const SECONDARY_BUTTON_CLASS =
  "inline-flex h-10 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.05] px-5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

export const WIZARD_STEPS = [
  { id: 1, label: "Connect Wallet", hint: "Attach admin account" },
  { id: 2, label: "Add Eligible", hint: "Whitelist voters" },
  { id: 3, label: "Freeze Registry", hint: "Lock voter set" },
  { id: 4, label: "Create Poll", hint: "Publish poll data" },
  { id: 5, label: "Manage Poll", hint: "Review tallies/finalize" },
] as const;
