import { NextResponse } from "next/server";
import { buildResume } from "@/lib/buildResume";
import type { ResumeFormData } from "@/types/builder";

export async function POST(request: Request) {
  try {
    const body: ResumeFormData = await request.json();

    if (!body.fullName?.trim()) {
      return NextResponse.json({ success: false, error: "Full name is required." }, { status: 400 });
    }
    if (!body.email?.trim()) {
      return NextResponse.json({ success: false, error: "Email is required." }, { status: 400 });
    }
    if (!body.workEntries?.length) {
      return NextResponse.json({ success: false, error: "At least one work entry is required." }, { status: 400 });
    }

    const markdown = await buildResume(body);
    return NextResponse.json({ success: true, data: { markdown } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
