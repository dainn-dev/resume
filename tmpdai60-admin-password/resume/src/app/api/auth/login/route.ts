import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, USER_INFO_COOKIE, callBackend } from "@/lib/backend";

interface BackendAuth {
  success: boolean;
  data?: {
    accessToken: string;
    refreshToken: string | null;
    accessTokenExpiresAt: string;
    refreshTokenExpiresAt: string | null;
    user: { id?: string; email?: string; firstName?: string; lastName?: string; displayName?: string } | null;
    requiresTwoFactor: boolean;
    twoFactorUserId: string | null;
  };
  error?: string;
}

export async function POST(request: Request) {
  const { recaptchaToken, ...body } = await request.json();
  const res = await callBackend<BackendAuth>("/api/auth/login", {
    method: "POST",
    body,
    headers: recaptchaToken ? { "X-Recaptcha-Token": recaptchaToken } : undefined,
  });

  if (!res.ok || !res.data?.success || !res.data.data) {
    return NextResponse.json({ success: false, error: res.data?.error ?? "Login failed." }, { status: res.status });
  }

  const auth = res.data.data;
  if (auth.requiresTwoFactor) {
    return NextResponse.json({ success: true, requiresTwoFactor: true, twoFactorUserId: auth.twoFactorUserId });
  }

  const user = auth.user ?? {};
  const displayName = user.displayName || user.firstName || user.email?.split("@")[0] || "";
  const response = NextResponse.json({
    success: true,
    user: { id: user.id, name: displayName, email: user.email },
  });

  const accessExpires = new Date(auth.accessTokenExpiresAt);
  const refreshExpires = auth.refreshTokenExpiresAt ? new Date(auth.refreshTokenExpiresAt) : undefined;

  response.cookies.set(ACCESS_TOKEN_COOKIE, auth.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: accessExpires,
    path: "/",
  });
  if (auth.refreshToken) {
    response.cookies.set(REFRESH_TOKEN_COOKIE, auth.refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      expires: refreshExpires,
      path: "/",
    });
  }
  response.cookies.set(USER_INFO_COOKIE, JSON.stringify({ id: user.id, name: displayName, email: user.email }), {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: refreshExpires ?? accessExpires,
    path: "/",
  });

  return response;
}
