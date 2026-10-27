import { connection } from "next/server";
import { ConfigError, productHandle } from "@/lib/server/env";
import { errorMessage, log } from "@/lib/server/log";
import { getCatalog } from "@/lib/server/shopify/storefront";

/** Live prices and availability for every size × finish, from Shopify. */
export async function GET() {
  await connection(); // per-request: prices and stock change in Shopify
  try {
    const catalog = await getCatalog(productHandle());
    return Response.json({ configured: true, ...catalog });
  } catch (err) {
    if (err instanceof ConfigError) return Response.json({ configured: false, variants: {} });
    log.error("catalog.failed", { error: errorMessage(err) });
    return Response.json({ configured: true, error: "unavailable", variants: {} }, { status: 502 });
  }
}
