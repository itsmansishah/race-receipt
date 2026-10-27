import { buyerIpFrom, startCheckout } from "@/lib/server/checkout";
import { getDb } from "@/lib/server/db";

const MAX_BODY_BYTES = 3_000_000; // design JSON plus one dithered photo

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return Response.json({ ok: false, code: "invalid_design", message: "That design is too large to save." }, { status: 413 });
  }
  let body: { design?: unknown; receiptId?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ ok: false, code: "invalid_design", message: "We couldn't read that design." }, { status: 400 });
  }
  const result = await startCheckout(getDb(), body, { buyerIp: buyerIpFrom(request.headers) });
  return Response.json(result, { status: result.ok ? 200 : result.code === "invalid_design" ? 400 : 409 });
}
