import { NextResponse } from "next/server";
import { callClaude } from "@/lib/callClaude";

const SYSTEM_PROMPT = `You are a professional translator. Translate the provided JSON content to the target language.

Rules:
- Translate ONLY string values, never change keys or numbers
- Preserve the exact JSON structure
- Keep technical terms, proper nouns, company names, and programming languages untranslated
- Return valid JSON only, no explanation or markdown`;

export async function POST(request: Request) {
  try {
    const { content, targetLocale } = await request.json();

    if (!content || !targetLocale) {
      return NextResponse.json(
        { success: false, error: "Missing content or targetLocale." },
        { status: 400 },
      );
    }

    if (targetLocale === "en") {
      return NextResponse.json({ success: true, data: content });
    }

    const localeName = targetLocale === "vi" ? "Vietnamese" : targetLocale;
    const contentStr = typeof content === "string" ? content : JSON.stringify(content);
    const isPlainText = typeof content === "string";

    const userPrompt = isPlainText
      ? `Translate the following text to ${localeName}. Return ONLY the translated text, no JSON wrapping, no quotes, no explanation.\n\n${contentStr}`
      : `Translate all string values in this JSON to ${localeName}. Return ONLY the translated JSON.\n\n${contentStr}`;

    const raw = await callClaude(SYSTEM_PROMPT, userPrompt, 4000);

    if (isPlainText) {
      return NextResponse.json({ success: true, data: raw.trim() });
    }

    const parsed = JSON.parse(raw.trim().replace(/^```json\s*/, "").replace(/```\s*$/, ""));
    return NextResponse.json({ success: true, data: parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Translation failed.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
