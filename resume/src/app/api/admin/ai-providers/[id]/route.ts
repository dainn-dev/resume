import { NextResponse } from "next/server";
import { callBackend, getServerAuthToken } from "@/lib/backend";

type Ctx = { params: { id: string } };

export async function PUT(request: Request, ctx: Ctx) {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });

  const { id } = await ctx.params;
  const res = await callBackend(`/api/admin/ai-providers/${encodeURIComponent(id)}`, { method: "PUT", authToken: token, forwardRequest: request });
  return NextResponse.json(res.data ?? { success: res.ok, error: res.raw }, { status: res.status });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });

  const { id } = await ctx.params;
  const res = await callBackend(`/api/admin/ai-providers/${encodeURIComponent(id)}`, { method: "DELETE", authToken: token });
  return NextResponse.json(res.data ?? { success: res.ok, error: res.raw }, { status: res.status });
}
