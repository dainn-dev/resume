"use client";

export default function TranslatingBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-xl px-5 py-3 animate-pulse">
      <svg className="w-4 h-4 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span className="text-blue-400 text-sm">{message}</span>
    </div>
  );
}
