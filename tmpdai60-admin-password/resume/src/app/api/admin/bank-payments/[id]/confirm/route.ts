import { NextResponse } from "next/server";
import { callBackend, getServerAuthToken } from "@/lib/backend";

export async function POST(request: Request, ctx: { params: { id: string } }) {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  const { id } = ctx.params;
  const body = await request.json().catch(() => ({}));
  const res = await callBackend(`/api/admin/bank-payments/${encodeURIComponent(id)}/confirm`, {
    method: "POST", authToken: token, body,
  });
  return NextResponse.json(res.data ?? { success: res.ok, error: res.raw }, { status: res.status });
}
