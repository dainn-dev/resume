import { NextResponse } from "next/server";
import { callBackend, getServerAuthToken } from "@/lib/backend";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });

  const res = await callBackend(`/api/admin/users/${encodeURIComponent(params.id)}/lockout`, {
    method: "POST", authToken: token, forwardRequest: request,
  });
  return NextResponse.json(res.data ?? { success: res.ok, error: res.raw }, { status: res.status });
}
