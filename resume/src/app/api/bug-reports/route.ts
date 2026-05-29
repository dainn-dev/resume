import { NextResponse } from "next/server";
import { callBackend, getServerAuthToken } from "@/lib/backend";

export async function POST(request: Request) {
  // Public endpoint: forward the auth token only if the visitor happens to be signed in.
  const token = await getServerAuthToken();
  const { recaptchaToken, ...body } = await request.json();
  const res = await callBackend("/api/bug-reports", {
    method: "POST",
    authToken: token,
    body,
    headers: recaptchaToken ? { "X-Recaptcha-Token": recaptchaToken } : undefined,
  });
  return NextResponse.json(res.data ?? { success: res.ok, error: res.raw }, { status: res.status });
}
