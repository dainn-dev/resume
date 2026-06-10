import { NextResponse } from "next/server";
import { callBackend, getServerAuthToken } from "@/lib/backend";

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });

  const { id } = ctx.params;
  const res = await callBackend(`/api/billing/bank/payments/${encodeURIComponent(id)}`, { authToken: token });
  return NextResponse.json(res.data ?? { success: res.ok, error: res.raw }, { status: res.status });
}
