import { useEffect, useState } from "react";

import type { Notice } from "../types";

type NoticeToastProps = {
  notice: Notice | null;
  onDismiss: () => void;
};

const AUTO_DISMISS_MS = 5000;

export function NoticeToast({ notice, onDismiss }: NoticeToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!notice) {
      setVisible(false);
      return;
    }

    // Trigger enter animation
    const enterFrame = requestAnimationFrame(() => setVisible(true));

    const timer = setTimeout(() => {
      setVisible(false);
      // Wait for exit animation before clearing
      setTimeout(onDismiss, 300);
    }, AUTO_DISMISS_MS);

    return () => {
      cancelAnimationFrame(enterFrame);
      clearTimeout(timer);
    };
  }, [notice, onDismiss]);

  if (!notice) return null;

  const icon =
    notice.type === "error" ? (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
    ) : notice.type === "success" ? (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    ) : (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
      </svg>
    );

  const toneClass =
    notice.type === "error"
      ? "border-red-500/20 bg-red-950/80 text-red-300"
      : notice.type === "success"
        ? "border-emerald-500/20 bg-emerald-950/80 text-emerald-300"
        : "border-[#633CFF]/20 bg-[#1a1035]/80 text-[#c4b5fd]";

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-end p-6">
      <div
        className={`pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-xl transition-all duration-300 ${toneClass} ${
          visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
      >
        {icon}
        <p className="min-w-0 flex-1 break-words">{notice.message}</p>
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            setTimeout(onDismiss, 300);
          }}
          className="shrink-0 rounded p-0.5 opacity-50 transition hover:opacity-100"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
