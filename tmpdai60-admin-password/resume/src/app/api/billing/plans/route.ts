import { NextResponse } from "next/server";
import { callBackend, getServerAuthToken } from "@/lib/backend";

export async function GET() {
  const token = await getServerAuthToken();
  const res = await callBackend("/api/billing/plans", { authToken: token });
  return NextResponse.json(res.data ?? { success: res.ok }, { status: res.status });
}
