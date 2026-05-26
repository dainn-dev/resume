import { NextResponse } from "next/server";
import { callBackend, getServerAuthToken } from "@/lib/backend";

export async function POST(request: Request) {
  const token = await getServerAuthToken();
  const res = await callBackend("/api/translate", { method: "POST", authToken: token, forwardRequest: request });
  return NextResponse.json(res.data ?? { success: res.ok, error: res.raw }, { status: res.status });
}
