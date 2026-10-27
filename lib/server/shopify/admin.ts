import "server-only";

import { adminConfig } from "../env";
import { errorMessage } from "../log";
import { ShopifyError } from "./storefront";

// Admin API access for a Dev Dashboard app installed on a store in the same
// organization. There is no long-lived Admin token: the client credentials
// grant returns one valid for 24 hours, cached here and renewed early.

let token: { value: string; expiresAt: number } | null = null;

async function getAdminToken(): Promise<string> {
  if (token && Date.now() < token.expiresAt) return token.value;
  const { domain, clientId, clientSecret } = adminConfig();
  let res: Response;
  try {
    res = await fetch(`https://${domain}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new ShopifyError(`Admin token request failed: ${errorMessage(err)}`, "network");
  }
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !body.access_token) {
    throw new ShopifyError(
      `Admin token request failed (HTTP ${res.status}${body.error ? `: ${body.error}` : ""}). ` +
        "Check the client ID/secret and that the app is installed on this store.",
      "http",
    );
  }
  // Renew five minutes before Shopify's 24 h expiry.
  token = { value: body.access_token, expiresAt: Date.now() + ((body.expires_in ?? 86399) - 300) * 1000 };
  return token.value;
}

export async function adminQuery<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const { domain, apiVersion } = adminConfig();
  const res = await fetch(`https://${domain}/admin/api/${apiVersion}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": await getAdminToken() },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new ShopifyError(`Admin API HTTP ${res.status}`, "http");
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new ShopifyError(json.errors.map((e) => e.message).join("; "));
  return json.data as T;
}
