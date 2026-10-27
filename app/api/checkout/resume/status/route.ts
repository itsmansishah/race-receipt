import { getDb } from "@/lib/server/db";
import { getReceipt } from "@/lib/server/receipts";

/** Read-only: has this saved receipt been paid? No Shopify calls. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { receiptId?: unknown };
  const receipt = typeof body.receiptId === "string" ? getReceipt(getDb(), body.receiptId) : null;
  if (!receipt) return Response.json({ found: false });
  return Response.json({ found: true, paid: receipt.status !== "pending_payment", orderName: receipt.orderName });
}
