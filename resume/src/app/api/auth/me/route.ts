import { NextResponse } from "next/server";
import { callBackend, getServerAuthToken } from "@/lib/backend";

export async function GET() {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Not authenticated." }, { status: 401 });

  const res = await callBackend<{ success: boolean; data?: unknown; error?: string }>("/api/users/me", { authToken: token });
  if (!res.ok || !res.data?.success) {
    return NextResponse.json({ success: false, error: res.data?.error ?? "Failed to load profile." }, { status: res.status });
  }
  return NextResponse.json({ success: true, data: res.data.data });
}
