import { buyerIpFrom, resumeCheckout } from "@/lib/server/checkout";
import { getDb } from "@/lib/server/db";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { receiptId?: unknown };
  const result = await resumeCheckout(getDb(), body.receiptId, { buyerIp: buyerIpFrom(request.headers) });
  return Response.json(result, { status: result.ok ? 200 : 409 });
}
