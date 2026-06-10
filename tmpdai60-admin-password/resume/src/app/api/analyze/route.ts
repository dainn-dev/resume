import { NextResponse } from "next/server";
import { callBackend, getServerAuthToken } from "@/lib/backend";

export const maxDuration = 300;

export async function POST(request: Request) {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Sign in to analyze resumes." }, { status: 401 });

  const res = await callBackend("/api/analyze", { method: "POST", authToken: token, forwardRequest: request });
  return NextResponse.json(res.data ?? { success: res.ok, error: res.raw }, { status: res.status });
}
