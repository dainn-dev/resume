export interface AuthUser {
  id?: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

const USER_COOKIE = "dresume_user";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getAuthUser(): AuthUser | null {
  const raw = readCookie(USER_COOKIE);
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthUser; } catch { return null; }
}

export function isAuthenticated(): boolean {
  return getAuthUser() !== null;
}

export async function loginRequest(email: string, password: string, recaptchaToken?: string | null): Promise<{ user?: AuthUser; error?: string; requiresTwoFactor?: boolean }> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, recaptchaToken }),
  });
  const data = await res.json().catch(() => ({ error: "Login failed." }));
  if (!res.ok || !data?.success) return { error: data?.error ?? "Login failed." };
  if (data.requiresTwoFactor) return { requiresTwoFactor: true };
  return { user: data.user };
}

export async function registerRequest(name: string, email: string, password: string, recaptchaToken?: string | null): Promise<{ ok: boolean; message?: string; error?: string }> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, recaptchaToken }),
  });
  const data = await res.json().catch(() => ({ error: "Registration failed." }));
  if (!res.ok || !data?.success) return { ok: false, error: data?.error ?? "Registration failed." };
  return { ok: true, message: data.message };
}

export async function googleCallback(code: string, state: string): Promise<{ user?: AuthUser; error?: string }> {
  const res = await fetch("/api/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, state }),
  });
  const data = await res.json().catch(() => ({ error: "Google sign-in failed." }));
  if (!res.ok || !data?.success) return { error: data?.error ?? "Google sign-in failed." };
  return { user: data.user };
}

export async function logoutRequest(): Promise<void> {
  try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* ignore */ }
}
