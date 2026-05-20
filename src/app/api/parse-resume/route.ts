import { NextResponse } from "next/server";
import { parseResume } from "@/lib/parseResume";

export async function POST(request: Request) {
  try {
    const { resumeText } = await request.json();

    if (!resumeText?.trim()) {
      return NextResponse.json({ success: false, error: "No resume text provided." }, { status: 400 });
    }

    const formData = await parseResume(resumeText);
    return NextResponse.json({ success: true, data: formData });
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
