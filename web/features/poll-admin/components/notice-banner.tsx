import type { Notice } from "../types";

type NoticeBannerProps = {
  notice: Notice | null;
};

export function NoticeBanner({ notice }: NoticeBannerProps) {
  if (!notice) {
    return null;
  }

  const toneClass =
    notice.type === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : notice.type === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-blue-200 bg-blue-50 text-blue-700";

  return <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${toneClass}`}>{notice.message}</div>;
}
