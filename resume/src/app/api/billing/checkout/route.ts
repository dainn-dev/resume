import { NextResponse } from "next/server";
import { callBackend, getServerAuthToken } from "@/lib/backend";

export async function POST(request: Request) {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });

  const body = await request.json();
  const res = await callBackend("/api/billing/checkout", { method: "POST", authToken: token, body });
  return NextResponse.json(res.data ?? { success: res.ok }, { status: res.status });
}
