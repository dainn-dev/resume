import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, USER_INFO_COOKIE, callBackend } from "@/lib/backend";

export async function POST() {
  const store = await cookies();
  const accessToken = store.get(ACCESS_TOKEN_COOKIE)?.value;
  if (accessToken) {
    try { await callBackend("/api/auth/logout", { method: "POST", authToken: accessToken }); } catch { /* ignore */ }
  }

  const response = NextResponse.json({ success: true });
  for (const name of [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, USER_INFO_COOKIE]) {
    response.cookies.set(name, "", { httpOnly: name !== USER_INFO_COOKIE, expires: new Date(0), path: "/" });
  }
  return response;
}
