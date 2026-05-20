import { NextResponse } from "next/server";
import { generateCoverLetter } from "@/lib/generateCoverLetter";
import type { CoverLetterFormData } from "@/types/builder";

export async function POST(request: Request) {
  try {
    const body: CoverLetterFormData = await request.json();

    if (!body.jobTitle?.trim()) {
      return NextResponse.json({ success: false, error: "Job title is required." }, { status: 400 });
    }
    if (!body.company?.trim()) {
      return NextResponse.json({ success: false, error: "Company name is required." }, { status: 400 });
    }
    if (!body.jobDescription?.trim()) {
      return NextResponse.json({ success: false, error: "Job description is required." }, { status: 400 });
    }
    if (!body.aboutYourself?.trim()) {
      return NextResponse.json({ success: false, error: "About yourself is required." }, { status: 400 });
    }

    // Truncate job description to 3000 chars
    body.jobDescription = body.jobDescription.slice(0, 3000);

    const text = await generateCoverLetter(body);
    return NextResponse.json({ success: true, data: { text } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
