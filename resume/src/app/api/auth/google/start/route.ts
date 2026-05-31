import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/googleOauth";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

// Derive the public origin from forwarded headers (works behind the reverse proxy).
function publicOrigin(request: Request): string {
  const h = request.headers;
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

// GET /api/auth/google/start — kicks off the Google OAuth authorization-code flow.
// Builds the consent-screen URL, stores an anti-CSRF state cookie, and 302-redirects to Google.
export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const origin = publicOrigin(request);

  if (!clientId) {
    return NextResponse.redirect(`${origin}/login?error=google_not_configured`);
  }

  const state = randomUUID();
  const redirectUri = `${origin}/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "select_account",
  });

  const response = NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600, // 10 minutes to complete the flow
    path: "/",
  });
  return response;
}
