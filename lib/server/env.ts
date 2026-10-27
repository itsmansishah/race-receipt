import "server-only";

// Server configuration. Secrets are read only here, on the server; nothing in
// this module is ever passed to client components.

function read(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export class ConfigError extends Error {
  constructor(public missing: string[]) {
    super(`Missing environment variables: ${missing.join(", ")}. See .env.example and docs/shopify-setup.md.`);
  }
}

function required<const K extends string>(names: readonly K[]): Record<K, string> {
  const missing = names.filter((n) => !read(n));
  if (missing.length) throw new ConfigError(missing);
  return Object.fromEntries(names.map((n) => [n, read(n)!])) as Record<K, string>;
}

export const DEFAULT_API_VERSION = "2026-10";

/** "your-store.myshopify.com", tolerant of a pasted https:// prefix or trailing slash. */
function normalizeDomain(domain: string): string {
  return domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export function storefrontConfig() {
  const env = required(["SHOPIFY_STORE_DOMAIN", "SHOPIFY_STOREFRONT_PRIVATE_TOKEN"] as const);
  return {
    domain: normalizeDomain(env.SHOPIFY_STORE_DOMAIN),
    privateToken: env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN,
    apiVersion: read("SHOPIFY_API_VERSION") ?? DEFAULT_API_VERSION,
  };
}

export function adminConfig() {
  const env = required(["SHOPIFY_STORE_DOMAIN", "SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET"] as const);
  return {
    domain: normalizeDomain(env.SHOPIFY_STORE_DOMAIN),
    clientId: env.SHOPIFY_CLIENT_ID,
    clientSecret: env.SHOPIFY_CLIENT_SECRET,
    apiVersion: read("SHOPIFY_API_VERSION") ?? DEFAULT_API_VERSION,
  };
}

/** The app's client secret signs webhooks. */
export function webhookSecret(): string {
  return required(["SHOPIFY_CLIENT_SECRET"] as const).SHOPIFY_CLIENT_SECRET;
}

export function renderSecret(): string {
  return required(["RENDER_SECRET"] as const).RENDER_SECRET;
}

export function siteUrl(): string {
  return (read("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function databasePath(): string {
  return read("DATABASE_URL")?.replace(/^file:/, "") ?? "./data/race-receipt.db";
}

export function storageDir(): string {
  return read("STORAGE_DIR") ?? "./storage";
}

/** Shopify product handle for the single placeholder product. */
export function productHandle(): string {
  return read("SHOPIFY_PRODUCT_HANDLE") ?? "race-receipt";
}

/** Where the worker loads /render pages from. Usually the local Next server, not the public tunnel. */
export function renderBaseUrl(): string {
  return (read("RENDER_BASE_URL") ?? siteUrl()).replace(/\/+$/, "");
}
