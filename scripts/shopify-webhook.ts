// Points the orders/paid webhook at a public URL (for local dev, your tunnel).
//   npm run shopify:webhook -- https://your-tunnel.trycloudflare.com
// Removes orders/paid subscriptions that point anywhere else, then creates one if needed.
import "./load-env";
import { adminQuery } from "@/lib/server/shopify/admin";

const PATH = "/api/webhooks/shopify/orders-paid";

async function main() {
  const base = process.argv[2]?.replace(/\/+$/, "");
  if (!base?.startsWith("https://")) {
    console.error("Usage: npm run shopify:webhook -- https://<public-https-url>");
    process.exit(1);
  }
  const uri = `${base}${PATH}`;

  const existing = await adminQuery<{ webhookSubscriptions: { nodes: { id: string; uri: string }[] } }>(
    `query { webhookSubscriptions(first: 50, topics: [ORDERS_PAID]) { nodes { id uri } } }`,
  );
  let found = false;
  for (const sub of existing.webhookSubscriptions.nodes) {
    if (sub.uri === uri) {
      found = true;
      continue;
    }
    await adminQuery(`mutation($id: ID!) { webhookSubscriptionDelete(id: $id) { userErrors { message } } }`, { id: sub.id });
    console.log(`Removed old subscription → ${sub.uri}`);
  }
  if (found) {
    console.log(`orders/paid already delivers to ${uri}`);
    return;
  }
  const created = await adminQuery<{
    webhookSubscriptionCreate: { webhookSubscription: { id: string } | null; userErrors: { message: string }[] };
  }>(
    `mutation($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) {
        webhookSubscription { id }
        userErrors { message }
      }
    }`,
    { topic: "ORDERS_PAID", sub: { uri, format: "JSON" } },
  );
  const { userErrors, webhookSubscription } = created.webhookSubscriptionCreate;
  if (userErrors.length) throw new Error(userErrors.map((e) => e.message).join("; "));
  console.log(`✓ orders/paid → ${uri} (${webhookSubscription?.id})`);
}

main().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
