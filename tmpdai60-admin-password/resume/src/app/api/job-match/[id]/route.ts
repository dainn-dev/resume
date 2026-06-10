import { NextResponse } from "next/server";
import { callBackend, getServerAuthToken } from "@/lib/backend";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, ctx: Ctx) {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });

  const { id } = await ctx.params;
  const res = await callBackend(`/api/job-match/${encodeURIComponent(id)}`, { authToken: token });
  return NextResponse.json(res.data ?? { success: res.ok }, { status: res.status });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });

  const { id } = await ctx.params;
  const res = await callBackend(`/api/job-match/${encodeURIComponent(id)}`, { method: "PATCH", authToken: token, forwardRequest: request });
  return NextResponse.json(res.data ?? { success: res.ok, error: res.raw }, { status: res.status });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });

  const { id } = await ctx.params;
  const res = await callBackend(`/api/job-match/${encodeURIComponent(id)}`, { method: "DELETE", authToken: token });
  return NextResponse.json(res.data ?? { success: res.ok, error: res.raw }, { status: res.status });
}
