// Catches paid orders whose webhook never arrived (Shopify gives up after 8 retries).
//   npm run reconcile            # last 3 days
//   npm run reconcile -- 14      # last 14 days
// Safe to run any time: processing is idempotent.
import "./load-env";
import { getDb } from "@/lib/server/db";
import { log } from "@/lib/server/log";
import { processPaidOrder } from "@/lib/server/orders";
import type { PaidOrder } from "@/lib/server/receipts";
import { adminQuery } from "@/lib/server/shopify/admin";

const QUERY = `
  query PaidOrders($query: String!, $after: String) {
    orders(first: 50, after: $after, query: $query, sortKey: UPDATED_AT) {
      nodes {
        legacyResourceId
        name
        email
        customAttributes { key value }
        shippingAddress { name address1 address2 city province zip country phone }
        lineItems(first: 20) { nodes { customAttributes { key value } } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

interface OrderNode {
  legacyResourceId: string;
  name: string;
  email: string | null;
  customAttributes: { key: string; value: string | null }[];
  shippingAddress: Record<string, unknown> | null;
  lineItems: { nodes: { customAttributes: { key: string; value: string | null }[] }[] };
}

/** Same shape the orders/paid webhook delivers. */
function toPaidOrder(o: OrderNode): PaidOrder {
  return {
    id: o.legacyResourceId,
    name: o.name,
    email: o.email,
    shipping_address: o.shippingAddress,
    note_attributes: o.customAttributes.map((a) => ({ name: a.key, value: a.value })),
    line_items: o.lineItems.nodes.map((l) => ({ properties: l.customAttributes.map((a) => ({ name: a.key, value: a.value })) })),
  };
}

async function main() {
  const days = Number(process.argv[2] ?? 3);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const db = getDb();
  let after: string | null = null;
  let seen = 0;
  let queued = 0;
  do {
    const data: { orders: { nodes: OrderNode[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } } =
      await adminQuery(QUERY, { query: `financial_status:paid updated_at:>='${since}'`, after });
    for (const node of data.orders.nodes) {
      seen++;
      const outcome = processPaidOrder(db, toPaidOrder(node));
      queued += outcome.renderQueued.length;
      if (outcome.renderQueued.length) log.warn("reconcile.recovered", { order: node.name, ...outcome });
    }
    after = data.orders.pageInfo.hasNextPage ? data.orders.pageInfo.endCursor : null;
  } while (after);
  console.log(`Checked ${seen} paid orders from the last ${days} days; queued ${queued} missed renders.`);
}

main().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
