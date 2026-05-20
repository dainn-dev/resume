import { NextResponse } from "next/server";
import { analyzeJobMatch } from "@/lib/analyzeJobMatch";

async function fetchJobDescription(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch URL (HTTP ${res.status}). Please paste the job description manually.`);
  }

  const html = await res.text();

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (text.length < 300) {
    throw new Error("Could not extract text from that URL (login required or blocked). Please paste the job description manually.");
  }

  return text.slice(0, 5000);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { resumeText, jobDescription, linkedinUrl } = body as {
      resumeText?: string;
      jobDescription?: string;
      linkedinUrl?: string;
    };

    if (!resumeText?.trim()) {
      return NextResponse.json({ success: false, error: "Resume text is required." }, { status: 400 });
    }

    let jd = jobDescription ?? "";

    if (!jd.trim() && linkedinUrl?.trim()) {
      jd = await fetchJobDescription(linkedinUrl.trim());
    }

    if (!jd.trim()) {
      return NextResponse.json({ success: false, error: "Please provide a job description or URL." }, { status: 400 });
    }

    const analysis = await analyzeJobMatch(resumeText, jd);
    return NextResponse.json({ success: true, data: analysis, jobDescription: jd });
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
