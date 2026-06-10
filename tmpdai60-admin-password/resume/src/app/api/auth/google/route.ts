import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, USER_INFO_COOKIE, callBackend } from "@/lib/backend";
import { GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/googleOauth";

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

function publicOrigin(request: Request): string {
  const h = request.headers;
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// POST /api/auth/google — exchanges the Google authorization code for a DResume session.
// Verifies the anti-CSRF state, forwards the code to the backend, and sets the auth cookies.
export async function POST(request: Request) {
  const { code, state } = await request.json().catch(() => ({}));

  if (!code || !state) {
    return NextResponse.json({ success: false, error: "Missing authorization code." }, { status: 400 });
  }
  const expectedState = readCookie(request, GOOGLE_OAUTH_STATE_COOKIE);
  if (!expectedState || expectedState !== state) {
    return NextResponse.json({ success: false, error: "Invalid or expired sign-in state. Please try again." }, { status: 400 });
  }

  // redirect_uri must exactly match the one used in /start (Google enforces this on token exchange).
  const callbackUrl = `${publicOrigin(request)}/auth/google/callback`;
  const res = await callBackend<BackendAuth>("/api/auth/google", {
    method: "POST",
    body: { authorizationCode: code, callbackUrl },
  });

  if (!res.ok || !res.data?.success || !res.data.data) {
    return NextResponse.json({ success: false, error: res.data?.error ?? "Google sign-in failed." }, { status: res.status });
  }

  const auth = res.data.data;
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
  // One-time state cookie has served its purpose.
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", { maxAge: 0, path: "/" });

  return response;
}
