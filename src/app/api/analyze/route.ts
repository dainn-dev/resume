import { NextResponse } from "next/server";
import { validateFile } from "@/lib/validators";
import { extractText } from "@/lib/extractText";
import { analyzeResume } from "@/lib/analyzeResume";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided." },
        { status: 400 }
      );
    }

    validateFile(file);

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractText(buffer, file.type, file.name);

    if (!text.trim()) {
      return NextResponse.json(
        { success: false, error: "Could not extract text from the file. Please ensure it is not a scanned image." },
        { status: 400 }
      );
    }

    const analysis = await analyzeResume(text);

    return NextResponse.json({ success: true, data: analysis, resumeText: text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
