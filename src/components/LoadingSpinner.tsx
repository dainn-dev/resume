"use client";

interface LoadingSpinnerProps {
  message?: string;
  subMessage?: string;
}

export default function LoadingSpinner({
  message = "Analyzing your resume…",
  subMessage = "Claude AI is reviewing each section",
}: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border-4 border-gray-800" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-white font-semibold text-lg">{message}</p>
        <p className="text-gray-400 text-sm mt-1">{subMessage}</p>
      </div>
    </div>
  );
}
