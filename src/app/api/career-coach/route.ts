import { NextResponse } from "next/server";
import { coachCareer } from "@/lib/coachCareer";
import type { CareerCoachFormData } from "@/types/builder";

export async function POST(request: Request) {
  try {
    const form = (await request.json()) as CareerCoachFormData;

    if (!form.careerGoal?.trim()) {
      return NextResponse.json(
        { success: false, error: "Career goal is required." },
        { status: 400 },
      );
    }
    if (!form.timeline?.trim()) {
      return NextResponse.json(
        { success: false, error: "Timeline is required." },
        { status: 400 },
      );
    }
    if (!form.focusAreas?.length) {
      return NextResponse.json(
        { success: false, error: "At least one focus area is required." },
        { status: 400 },
      );
    }

    form.resumeSummary = (form.resumeSummary || "").slice(0, 8000);
    form.currentSkills = (form.currentSkills || "").slice(0, 2000);
    form.experienceSummary = (form.experienceSummary || "").slice(0, 3000);
    form.jobMatchGaps = (form.jobMatchGaps || "").slice(0, 1500);
    form.salaryInsights = (form.salaryInsights || "").slice(0, 1000);

    const { result, analysis } = await coachCareer(form);
    return NextResponse.json({ success: true, data: { result, analysis } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
