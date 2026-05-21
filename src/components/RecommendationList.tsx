"use client";

import { useState } from "react";
import { useTranslation } from "@/components/TranslationProvider";
import type { SectionAnalysis } from "@/types/resume";

interface RecommendationListProps {
  sections: Record<string, SectionAnalysis>;
}

function scoreColor(score: number): string {
  if (score >= 75) return "bg-green-500/10 border-green-500/30 text-green-400";
  if (score >= 50) return "bg-amber-500/10 border-amber-500/30 text-amber-400";
  return "bg-red-500/10 border-red-500/30 text-red-400";
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${scoreColor(score)}`}>
      {score}/100
    </span>
  );
}

function SectionAccordion({ section, tipsLabel, suggestedLabel }: { section: SectionAnalysis; tipsLabel: string; suggestedLabel: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <ScoreBadge score={section.score} />
          <span className="font-medium text-white">{section.label}</span>
          <span className="text-xs text-gray-500">{section.tips.length} {tipsLabel}</span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-2 border-t border-gray-800 space-y-4">
          {section.tips.map((tip, i) => (
            <div key={i} className="space-y-2">
              {/* Problem */}
              <div className="flex gap-3 text-sm text-gray-300 leading-relaxed">
                <span className="text-red-400 mt-0.5 shrink-0">✕</span>
                <span>{tip.problem}</span>
              </div>
              {/* Suggestion */}
              <div className="ml-6 rounded-lg bg-green-500/5 border border-green-500/20 px-4 py-3">
                <p className="text-xs font-semibold text-green-400 mb-1 uppercase tracking-wide">{suggestedLabel}</p>
                <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{tip.suggestion}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RecommendationList({ sections }: RecommendationListProps) {
  const { t } = useTranslation();
  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-4">{t("results.improvementTips")}</h3>
      <div className="space-y-3">
        {Object.values(sections).map((section) => (
          <SectionAccordion key={section.label} section={section} tipsLabel={t("results.tipsCount")} suggestedLabel={t("results.suggestedUpdate")} />
        ))}
      </div>
    </div>
  );
}
