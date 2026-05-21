import { NextResponse } from "next/server";
import { estimateSalary } from "@/lib/estimateSalary";
import type { SalaryEstimatorFormData } from "@/types/builder";

export async function POST(request: Request) {
  try {
    const form = (await request.json()) as SalaryEstimatorFormData;

    if (!form.jobTitle?.trim() || !form.industry?.trim() || !form.location?.trim()) {
      return NextResponse.json(
        { success: false, error: "Job title, industry, and location are required." },
        { status: 400 }
      );
    }

    const { estimate, analysis } = await estimateSalary(form);
    return NextResponse.json({ success: true, data: { estimate, analysis } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
