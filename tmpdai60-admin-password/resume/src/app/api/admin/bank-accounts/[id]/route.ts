import { NextResponse } from "next/server";
import { callBackend, getServerAuthToken } from "@/lib/backend";

export async function PUT(request: Request, ctx: { params: { id: string } }) {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  const { id } = ctx.params;
  const body = await request.json();
  const res = await callBackend(`/api/admin/bank-accounts/${encodeURIComponent(id)}`, { method: "PUT", authToken: token, body });
  return NextResponse.json(res.data ?? { success: res.ok, error: res.raw }, { status: res.status });
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  const { id } = ctx.params;
  const res = await callBackend(`/api/admin/bank-accounts/${encodeURIComponent(id)}`, { method: "DELETE", authToken: token });
  return NextResponse.json(res.data ?? { success: res.ok, error: res.raw }, { status: res.status });
}
