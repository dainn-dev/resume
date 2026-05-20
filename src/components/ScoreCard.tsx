"use client";

import ProgressRing from "./ProgressRing";

interface ScoreCardProps {
  label: string;
  score: number;
}

function scoreLabel(score: number): string {
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

export default function ScoreCard({ label, score }: ScoreCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col items-center gap-3">
      <div className="relative">
        <ProgressRing score={score} size={88} strokeWidth={8} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-lg font-bold ${scoreLabel(score)}`}>{score}</span>
        </div>
      </div>
      <p className="text-sm text-gray-300 text-center font-medium leading-tight">{label}</p>
    </div>
  );
}
