import { NextResponse } from "next/server";
import { callBackend } from "@/lib/backend";

// Public, unauthenticated: serves an Approved portfolio's resume data by subdomain.
export async function GET(_req: Request, { params }: { params: { subdomain: string } }) {
  const res = await callBackend(`/api/public/portfolio/${encodeURIComponent(params.subdomain)}`);
  return NextResponse.json(res.data ?? { success: res.ok, error: res.raw }, { status: res.status });
}
