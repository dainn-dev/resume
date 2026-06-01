import { NextResponse } from "next/server";
import { backendUrl, getServerAuthToken } from "@/lib/backend";

// Binary passthrough: stream the backend's file response (PDF/DOCX/TXT) straight to the browser,
// preserving Content-Type and Content-Disposition so the download/filename works.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });

  const inline = new URL(req.url).searchParams.get("inline") === "true";
  const backendRes = await fetch(
    backendUrl(`/api/admin/resumes/${encodeURIComponent(params.id)}/file${inline ? "?inline=true" : ""}`),
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );

  const headers = new Headers();
  const ct = backendRes.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const cd = backendRes.headers.get("content-disposition");
  if (cd) headers.set("content-disposition", cd);

  return new NextResponse(backendRes.body, { status: backendRes.status, headers });
}
