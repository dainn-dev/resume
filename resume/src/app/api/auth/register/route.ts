import { NextResponse } from "next/server";
import { callBackend } from "@/lib/backend";

export async function POST(request: Request) {
  const body = await request.json();
  const payload = {
    email: body.email,
    password: body.password,
    username: body.name || body.username || body.email,
  };
  const res = await callBackend<{ success: boolean; data?: { userId: string; email: string; message: string }; error?: string }>(
    "/api/auth/register",
    { method: "POST", body: payload }
  );

  if (!res.ok || !res.data?.success) {
    return NextResponse.json({ success: false, error: res.data?.error ?? "Registration failed." }, { status: res.status });
  }
  return NextResponse.json({ success: true, ...res.data.data });
}
