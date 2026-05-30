"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { getCurrentResumeId } from "@/lib/pipeline";

const STEPS = [
  { key: "score", path: "/dashboard", label: "Score" },
  { key: "build", path: "/build", label: "Build" },
  { key: "jobMatch", path: "/job-match", label: "Match" },
  { key: "coverLetter", path: "/cover-letter", label: "Letter" },
  { key: "salary", path: "/salary-estimator", label: "Salary" },
  { key: "interview", path: "/interview-coach", label: "Interview" },
  { key: "career", path: "/career-coach", label: "Career" },
];

const PATH_TO_STEP: Record<string, number> = {};
STEPS.forEach((s, i) => { PATH_TO_STEP[s.path] = i; });
PATH_TO_STEP["/results"] = 0;

export default function PipelineWorkflow() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentIdx = PATH_TO_STEP[pathname] ?? -1;
  const rid = getCurrentResumeId() || searchParams.get("resumeId");

  if (currentIdx < 0) return null;

  return (
    <div className="mb-6 overflow-x-auto scrollbar-hide pb-1">
      <div className="flex items-start justify-center min-w-max mx-auto">
        {STEPS.map((step, i) => {
          const isDone = i < currentIdx;
          const isCurrent = i === currentIdx;
          const href = rid && i !== currentIdx
            ? `${step.path}?resumeId=${encodeURIComponent(rid)}`
            : undefined;

          const node = (
            <div className={`flex flex-col items-center shrink-0 w-12 sm:w-16 ${href ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}>
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isCurrent
                    ? "bg-blue-600 text-white ring-2 ring-blue-400/30 ring-offset-1 ring-offset-gray-950"
                    : isDone
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 border border-gray-700 text-gray-500"
                }`}
              >
                {isDone ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-5" /></svg>
                ) : i + 1}
              </div>
              <span
                className={`text-[10px] sm:text-xs mt-1 whitespace-nowrap ${
                  isCurrent ? "text-blue-400 font-semibold" : isDone ? "text-gray-400" : "text-gray-600"
                }`}
              >
                {step.label}
              </span>
            </div>
          );

          return (
            <div key={step.key} className="flex items-start">
              {href ? <Link href={href}>{node}</Link> : node}
              {i < STEPS.length - 1 && (
                <div className={`h-px mt-3.5 sm:mt-4 mx-0 w-4 sm:w-8 lg:w-12 shrink-0 ${i < currentIdx ? "bg-blue-600" : "bg-gray-800"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
