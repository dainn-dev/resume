import { NextResponse } from "next/server";
import { backendUrl, getServerAuthToken } from "@/lib/backend";

// Binary passthrough for the CSV export — forwards the current filters (search/plan/status/ids)
// and streams the file response back with its Content-Disposition intact.
export async function GET(req: Request) {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });

  const qs = new URL(req.url).searchParams.toString();
  const backendRes = await fetch(backendUrl(`/api/admin/users/export${qs ? `?${qs}` : ""}`), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const headers = new Headers();
  const ct = backendRes.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const cd = backendRes.headers.get("content-disposition");
  if (cd) headers.set("content-disposition", cd);

  return new NextResponse(backendRes.body, { status: backendRes.status, headers });
}
