import { NextResponse } from "next/server";
import { callBackend, getServerAuthToken } from "@/lib/backend";

export async function GET(request: Request) {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });

  const subdomain = new URL(request.url).searchParams.get("subdomain") ?? "";
  const res = await callBackend(`/api/portfolios/check?subdomain=${encodeURIComponent(subdomain)}`, { authToken: token });
  return NextResponse.json(res.data ?? { success: res.ok, error: res.raw }, { status: res.status });
}
