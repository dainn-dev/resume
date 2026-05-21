import { NextResponse } from "next/server";
import { coachInterview } from "@/lib/coachInterview";
import type { InterviewCoachFormData } from "@/types/builder";

export async function POST(request: Request) {
  try {
    const form = (await request.json()) as InterviewCoachFormData;

    if (!form.jobTitle?.trim()) {
      return NextResponse.json(
        { success: false, error: "Job title is required." },
        { status: 400 }
      );
    }
    if (!form.company?.trim()) {
      return NextResponse.json(
        { success: false, error: "Company name is required." },
        { status: 400 }
      );
    }
    if (!form.jobDescription?.trim()) {
      return NextResponse.json(
        { success: false, error: "Job description is required." },
        { status: 400 }
      );
    }

    // Truncate heavy fields on the server side for safety
    form.jobDescription = form.jobDescription.slice(0, 3000);
    form.resumeSummary = form.resumeSummary.slice(0, 2000);

    const { result, analysis } = await coachInterview(form);
    return NextResponse.json({ success: true, data: { result, analysis } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
