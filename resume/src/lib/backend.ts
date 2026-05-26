import { cookies } from "next/headers";

const BACKEND_URL = (process.env.DRESUME_API_URL ?? "http://localhost:5000").replace(/\/$/, "");

export const ACCESS_TOKEN_COOKIE = "dresume_access";
export const REFRESH_TOKEN_COOKIE = "dresume_refresh";
export const USER_INFO_COOKIE = "dresume_user";

export interface BackendResponse<T = unknown> {
  status: number;
  ok: boolean;
  data: T | null;
  raw: string;
}

export function backendUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${BACKEND_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

interface CallOptions {
  method?: string;
  body?: BodyInit | object | null;
  authToken?: string | null;
  headers?: HeadersInit;
  forwardRequest?: Request;
}

export async function callBackend<T = unknown>(path: string, opts: CallOptions = {}): Promise<BackendResponse<T>> {
  const { method = "GET", body, authToken, headers, forwardRequest } = opts;

  const finalHeaders = new Headers(headers);
  let finalBody: BodyInit | undefined;

  if (body !== undefined && body !== null) {
    if (typeof body === "string" || body instanceof FormData || body instanceof URLSearchParams || body instanceof Blob || body instanceof ArrayBuffer) {
      finalBody = body as BodyInit;
    } else {
      finalHeaders.set("Content-Type", "application/json");
      finalBody = JSON.stringify(body);
    }
  } else if (forwardRequest) {
    const contentType = forwardRequest.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      finalBody = await forwardRequest.formData();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      finalBody = await forwardRequest.formData();
    } else {
      const text = await forwardRequest.text();
      if (text.length > 0) {
        finalBody = text;
        if (!finalHeaders.has("Content-Type")) finalHeaders.set("Content-Type", contentType || "application/json");
      }
    }
  }

  if (authToken) finalHeaders.set("Authorization", `Bearer ${authToken}`);
  if (!finalHeaders.has("Accept")) finalHeaders.set("Accept", "application/json");

  const res = await fetch(backendUrl(path), {
    method,
    headers: finalHeaders,
    body: finalBody,
    cache: "no-store",
  });

  const raw = await res.text();
  let data: T | null = null;
  if (raw.length > 0) {
    try { data = JSON.parse(raw) as T; } catch { data = null; }
  }
  return { status: res.status, ok: res.ok, data, raw };
}

export async function getServerAuthToken(): Promise<string | null> {
  try {
    const store = await cookies();
    return store.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}
