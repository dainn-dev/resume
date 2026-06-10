import { NextResponse } from "next/server";
import { callBackend, getServerAuthToken } from "@/lib/backend";

export async function GET() {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });

  const res = await callBackend("/api/calendar", { method: "GET", authToken: token });
  return NextResponse.json(res.data ?? { success: res.ok, error: res.raw }, { status: res.status });
}

export async function PUT(request: Request) {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });

  const url = new URL(request.url);
  const backendPath = url.searchParams.get("path") ?? "/api/calendar/bulk";
  const res = await callBackend(backendPath, { method: "PUT", authToken: token, forwardRequest: request });
  return NextResponse.json(res.data ?? { success: res.ok, error: res.raw }, { status: res.status });
}

export async function POST(request: Request) {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });

  const url = new URL(request.url);
  const backendPath = url.searchParams.get("path") ?? "/api/calendar/goals";
  const res = await callBackend(backendPath, { method: "POST", authToken: token, forwardRequest: request });
  return NextResponse.json(res.data ?? { success: res.ok, error: res.raw }, { status: res.status });
}

export async function DELETE(request: Request) {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });

  const url = new URL(request.url);
  const backendPath = url.searchParams.get("path");
  if (!backendPath) return NextResponse.json({ success: false, error: "Path required." }, { status: 400 });

  const res = await callBackend(backendPath, { method: "DELETE", authToken: token });
  return NextResponse.json(res.data ?? { success: res.ok, error: res.raw }, { status: res.status });
}
