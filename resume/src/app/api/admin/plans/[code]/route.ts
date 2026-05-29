import { NextResponse } from "next/server";
import { callBackend, getServerAuthToken } from "@/lib/backend";

export async function PATCH(request: Request, { params }: { params: { code: string } }) {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  const res = await callBackend(`/api/admin/plans/${encodeURIComponent(params.code)}`, {
    method: "PATCH", authToken: token, forwardRequest: request,
  });
  return NextResponse.json(res.data ?? { success: res.ok, error: res.raw }, { status: res.status });
}
