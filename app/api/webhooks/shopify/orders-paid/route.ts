import { getDb } from "@/lib/server/db";
import { ConfigError, webhookSecret } from "@/lib/server/env";
import { log } from "@/lib/server/log";
import { handleOrdersPaidWebhook } from "@/lib/server/orders";

export async function POST(request: Request) {
  // Raw bytes first: the HMAC is over exactly what Shopify sent.
  const rawBody = Buffer.from(await request.arrayBuffer());
  let secret: string;
  try {
    secret = webhookSecret();
  } catch (err) {
    log.error("webhook.misconfigured", { error: err instanceof ConfigError ? err.message : String(err) });
    return Response.json({ error: "server misconfigured" }, { status: 500 });
  }
  const { status, body } = handleOrdersPaidWebhook(getDb(), secret, { rawBody, headers: request.headers });
  return Response.json(body, { status });
}
