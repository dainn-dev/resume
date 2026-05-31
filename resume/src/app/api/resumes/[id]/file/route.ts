import { NextResponse } from "next/server";
import { backendUrl, callBackend, getServerAuthToken } from "@/lib/backend";

// GET — stream the original uploaded file back to the browser (download, or inline preview with ?inline=true).
// We bypass callBackend here because the response is binary, not JSON.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const token = await getServerAuthToken();
  const inline = new URL(request.url).searchParams.get("inline") === "true";
  const path = `/api/resumes/${encodeURIComponent(params.id)}/file${inline ? "?inline=true" : ""}`;

  const res = await fetch(backendUrl(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ success: false, error: "File not found." }, { status: res.status });
  }

  const headers = new Headers();
  const contentType = res.headers.get("content-type");
  const disposition = res.headers.get("content-disposition");
  const length = res.headers.get("content-length");
  if (contentType) headers.set("content-type", contentType);
  if (disposition) headers.set("content-disposition", disposition);
  if (length) headers.set("content-length", length);

  return new Response(res.body, { status: 200, headers });
}

// DELETE — remove only the stored original file, keeping the resume record.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const token = await getServerAuthToken();
  const res = await callBackend(`/api/resumes/${encodeURIComponent(params.id)}/file`, {
    method: "DELETE",
    authToken: token,
  });
  return NextResponse.json(res.data ?? { success: res.ok }, { status: res.status });
}
