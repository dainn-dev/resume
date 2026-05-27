import { NextResponse } from "next/server";
import { callBackend, getServerAuthToken } from "@/lib/backend";

export const maxDuration = 300;

export async function POST(request: Request) {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });

  const body = await request.json();
  const res = await callBackend("/api/build/improve", { method: "POST", authToken: token, body });
  return NextResponse.json(res.data ?? { success: res.ok, error: res.raw }, { status: res.status });
}
