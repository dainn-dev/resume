"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

interface Step {
  key: string;
  label: string;
  description: string;
  href: string;
  sessionKey?: string;
  comingSoon?: boolean;
  icon: React.ReactNode;
}

const steps: Step[] = [
  {
    key: "score",
    label: "CV Scoring (ATS)",
    description: "Analyze your resume with AI-powered insights",
    href: "/",
    sessionKey: "resumeAnalysis",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" />
      </svg>
    ),
  },
  {
    key: "build",
    label: "AI Resume Builder",
    description: "Create a professional resume with AI assistance",
    href: "/build",
    sessionKey: "builtResume",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
      </svg>
    ),
  },
  {
    key: "match",
    label: "Job Matching Score",
    description: "Find your perfect job match with smart algorithms",
    href: "/job-match",
    sessionKey: "jobMatchContext",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
  {
    key: "cover",
    label: "Cover Letter Generator",
    description: "Generate compelling cover letters instantly",
    href: "/cover-letter",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    ),
  },
  {
    key: "salary",
    label: "Salary Estimator",
    description: "Get accurate salary estimates for your role",
    href: "/salary-estimator",
    sessionKey: "salaryEstimatorResult",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    key: "coach",
    label: "Interview Coach",
    description: "Prepare for your interview with AI coaching",
    href: "/interview-coach",
    sessionKey: "interviewCoachResult",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

export default function WorkflowProgress() {
  const pathname = usePathname();
  const router = useRouter();
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  useEffect(() => {
    const keys = new Set<string>();
    if (sessionStorage.getItem("resumeAnalysis")) keys.add("resumeAnalysis");
    if (sessionStorage.getItem("builtResume")) keys.add("builtResume");
    if (sessionStorage.getItem("jobMatchContext")) keys.add("jobMatchContext");
    if (sessionStorage.getItem("salaryEstimatorResult")) keys.add("salaryEstimatorResult");
    if (sessionStorage.getItem("interviewCoachResult")) keys.add("interviewCoachResult");
    setCompleted(keys);
  }, [pathname]);

  return (
    <div className="flex justify-between gap-4 overflow-x-auto pb-4 px-2 scrollbar-hide">
      {steps.map((step) => {
        const isActive = step.href === "/"
          ? pathname === "/" || pathname === "/results"
          : pathname === step.href;
        const isDone = !!(step.sessionKey && completed.has(step.sessionKey));
        const isClickable = !step.comingSoon;

        return (
          <div
            key={step.key}
            onClick={() => isClickable && router.push(step.href)}
            className={`flex flex-col items-center min-w-28 z-10 pt-2 ${isClickable ? "cursor-pointer group" : "cursor-default opacity-50"}`}
          >
            {/* Icon circle */}
            <div className={`relative w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300 mb-3 ${
              isActive
                ? "bg-[#6886eb] border-transparent text-white"
                : "bg-gray-950 border-gray-700 text-gray-500 group-hover:border-blue-500/50"
            }`}>
              {/* Icon — color changes on active/hover */}
              <span className={`${isActive ? "text-white" : "text-[#5C667B] group-hover:text-blue-500"} transition-colors duration-200`}>
                {step.icon}
              </span>

              {/* Completion badge */}
              {isDone && !isActive && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                </span>
              )}
            </div>

            {/* Label + description */}
            <div className="text-center max-w-36">
              <h3 className={`font-semibold text-sm mb-1 transition-colors ${isActive ? "text-white" : "text-gray-500 group-hover:text-white"}`}>
                {step.label}
                {step.comingSoon && <span className="ml-1 text-[10px] text-gray-600 font-normal">(soon)</span>}
              </h3>
              <p className={`text-xs leading-tight transition-colors ${isActive ? "text-gray-400" : "text-gray-600 group-hover:text-gray-500"}`}>
                {step.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
