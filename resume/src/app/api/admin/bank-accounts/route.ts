import { NextResponse } from "next/server";
import { callBackend, getServerAuthToken } from "@/lib/backend";

export async function GET() {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  const res = await callBackend("/api/admin/bank-accounts", { authToken: token });
  return NextResponse.json(res.data ?? { success: res.ok, error: res.raw }, { status: res.status });
}

export async function POST(request: Request) {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  const body = await request.json();
  const res = await callBackend("/api/admin/bank-accounts", { method: "POST", authToken: token, body });
  return NextResponse.json(res.data ?? { success: res.ok, error: res.raw }, { status: res.status });
}
