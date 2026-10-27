// Checks the Shopify setup end to end without placing an order.
//   npm run shopify:check
import "./load-env";
import { ConfigError, productHandle } from "@/lib/server/env";
import { adminQuery } from "@/lib/server/shopify/admin";
import { getCatalog } from "@/lib/server/shopify/storefront";
import { allFinishValues, SIZE_VALUES, variantKey } from "@/lib/catalog";

const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const bad = (msg: string) => console.log(`  ✗ ${msg}`);

async function step(name: string, fn: () => Promise<boolean>) {
  console.log(name);
  try {
    return await fn();
  } catch (err) {
    bad(err instanceof ConfigError ? err.message : err instanceof Error ? err.message : String(err));
    return false;
  }
}

async function main() {
  const results = [
    await step("Storefront API (Headless channel private token)", async () => {
      const catalog = await getCatalog(productHandle(), { fresh: true });
      const missing: string[] = [];
      for (const size of Object.values(SIZE_VALUES)) {
        for (const finish of allFinishValues()) {
          const v = catalog.variants[variantKey(size, finish)];
          if (!v) missing.push(`${size} / ${finish}`);
          else if (!v.availableForSale) bad(`${size} / ${finish} is not available for sale`);
        }
      }
      ok(`product "${productHandle()}" found with ${Object.keys(catalog.variants).length} matching variants`);
      if (missing.length) bad(`missing variants: ${missing.join(", ")}`);
      return missing.length === 0;
    }),
    await step("Admin API (Dev Dashboard app, client credentials)", async () => {
      const data = await adminQuery<{
        shop: { name: string };
        webhookSubscriptions: { nodes: { uri: string }[] };
      }>(`query { shop { name } webhookSubscriptions(first: 10, topics: [ORDERS_PAID]) { nodes { uri } } }`);
      ok(`connected to ${data.shop.name}`);
      if (data.webhookSubscriptions.nodes.length) data.webhookSubscriptions.nodes.forEach((s) => ok(`orders/paid → ${s.uri}`));
      else bad("no orders/paid webhook yet: run npm run shopify:webhook -- <your https url>");
      return data.webhookSubscriptions.nodes.length > 0;
    }),
    await step("Server secrets", async () => {
      const missing = ["RENDER_SECRET"].filter((k) => !process.env[k]);
      if (missing.length) bad(`missing ${missing.join(", ")}`);
      else ok("RENDER_SECRET set");
      return missing.length === 0;
    }),
  ];
  console.log(results.every(Boolean) ? "\nAll good." : "\nFix the ✗ items above, then run this again.");
  process.exit(results.every(Boolean) ? 0 : 1);
}

void main();
