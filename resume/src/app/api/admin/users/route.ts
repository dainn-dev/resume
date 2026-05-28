import { NextResponse } from "next/server";
import { callBackend, getServerAuthToken } from "@/lib/backend";

export async function GET(request: Request) {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });

  const url = new URL(request.url);
  const qs = url.search;
  const res = await callBackend(`/api/admin/users${qs}`, { method: "GET", authToken: token });
  return NextResponse.json(res.data ?? { success: res.ok, error: res.raw }, { status: res.status });
}
