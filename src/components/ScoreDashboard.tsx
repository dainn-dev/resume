"use client";

import ScoreCard from "./ScoreCard";
import ProgressRing from "./ProgressRing";
import type { ResumeAnalysis } from "@/types/resume";

interface ScoreDashboardProps {
  analysis: ResumeAnalysis;
}

export default function ScoreDashboard({ analysis }: ScoreDashboardProps) {
  const sections = Object.values(analysis.sections);

  return (
    <div className="space-y-8">
      {/* Overall score hero */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 flex flex-col items-center gap-4">
        <div className="relative">
          <ProgressRing score={analysis.overallScore} size={140} strokeWidth={12} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-white">{analysis.overallScore}</span>
            <span className="text-xs text-gray-400">/100</span>
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Overall Score</h2>
          <p className="text-gray-400 text-sm max-w-xl leading-relaxed">{analysis.overallSummary}</p>
        </div>
      </div>

      {/* Section scores grid */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Section Breakdown</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {sections.map((section) => (
            <ScoreCard key={section.label} label={section.label} score={section.score} />
          ))}
        </div>
      </div>
    </div>
  );
}
