export const CARD_CLASS =
  "rounded-2xl border border-white/[0.08] bg-white/[0.04] p-8 backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset,0_20px_50px_-12px_rgba(0,0,0,0.5)]";

export const INPUT_CLASS =
  "h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 text-base text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-[#633CFF]/50 focus:bg-white/[0.07] focus:ring-1 focus:ring-[#633CFF]/25";

export const TEXTAREA_CLASS =
  "min-h-[160px] w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-[#633CFF]/50 focus:bg-white/[0.07] focus:ring-1 focus:ring-[#633CFF]/25";

export const PRIMARY_BUTTON_CLASS =
  "inline-flex h-12 cursor-pointer items-center justify-center rounded-xl bg-gradient-to-r from-[#633CFF] to-[#4f46e5] px-6 text-base font-medium text-white shadow-[0_0_20px_-4px_rgba(99,60,255,0.5)] transition hover:from-[#7c5cff] hover:to-[#6366f1] hover:shadow-[0_0_24px_-4px_rgba(99,60,255,0.65)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none";

export const SECONDARY_BUTTON_CLASS =
  "inline-flex h-12 cursor-pointer items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.05] px-6 text-base font-medium text-slate-300 transition hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

export const WIZARD_STEPS = [
  { id: 1, label: "Connect Wallet", hint: "Attach admin account" },
  { id: 2, label: "Register Eligible", hint: "Whitelist & freeze voters" },
  { id: 3, label: "Open Poll", hint: "Publish poll data" },
  { id: 4, label: "Manage Poll", hint: "Review tallies/finalize" },
] as const;
