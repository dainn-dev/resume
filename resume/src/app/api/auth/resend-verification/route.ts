import { NextResponse } from "next/server";
import { callBackend } from "@/lib/backend";

export async function POST(request: Request) {
  const body = await request.json();
  const res = await callBackend("/api/auth/resend-verification", { method: "POST", body });
  return NextResponse.json(res.data ?? { success: res.ok }, { status: res.status });
}
