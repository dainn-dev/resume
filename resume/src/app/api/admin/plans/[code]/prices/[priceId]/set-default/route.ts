import { NextResponse } from "next/server";
import { callBackend, getServerAuthToken } from "@/lib/backend";

export async function POST(_request: Request, { params }: { params: { code: string; priceId: string } }) {
  const token = await getServerAuthToken();
  if (!token) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  const res = await callBackend(
    `/api/admin/plans/${encodeURIComponent(params.code)}/prices/${encodeURIComponent(params.priceId)}/set-default`,
    { method: "POST", authToken: token },
  );
  return NextResponse.json(res.data ?? { success: res.ok, error: res.raw }, { status: res.status });
}
