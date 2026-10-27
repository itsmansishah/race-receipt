import "server-only";

import { storefrontConfig } from "../env";
import { errorMessage, log } from "../log";
import { FINISH_OPTION, SIZE_OPTION, variantKey, type Catalog, type CatalogVariant } from "../../catalog";

// Storefront API, called from our server with the Headless channel's private
// token. The browser never talks to Shopify directly.

export class ShopifyError extends Error {
  constructor(
    message: string,
    public code: "network" | "http" | "graphql" = "graphql",
  ) {
    super(message);
  }
}

export async function storefrontQuery<T>(
  query: string,
  variables: Record<string, unknown> = {},
  { buyerIp }: { buyerIp?: string | null } = {},
): Promise<T> {
  const { domain, privateToken, apiVersion } = storefrontConfig();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Shopify-Storefront-Private-Token": privateToken,
  };
  // Required with the private token so Shopify rate-limits and attributes per buyer.
  if (buyerIp) headers["Shopify-Storefront-Buyer-IP"] = buyerIp;

  let res: Response;
  try {
    res = await fetch(`https://${domain}/api/${apiVersion}/graphql.json`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new ShopifyError(`Storefront API unreachable: ${errorMessage(err)}`, "network");
  }
  if (!res.ok) throw new ShopifyError(`Storefront API HTTP ${res.status}`, "http");
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new ShopifyError(json.errors.map((e) => e.message).join("; "));
  if (!json.data) throw new ShopifyError("Storefront API returned no data");
  return json.data;
}

// ---- Catalog ---------------------------------------------------------------

const PRODUCT_QUERY = /* GraphQL */ `
  query RaceReceiptProduct($handle: String!) {
    product(handle: $handle) {
      id
      variants(first: 50) {
        nodes {
          id
          availableForSale
          price { amount currencyCode }
          selectedOptions { name value }
        }
      }
    }
  }
`;

interface ProductData {
  product: {
    id: string;
    variants: {
      nodes: {
        id: string;
        availableForSale: boolean;
        price: { amount: string; currencyCode: string };
        selectedOptions: { name: string; value: string }[];
      }[];
    };
  } | null;
}

let cache: { at: number; handle: string; catalog: Catalog } | null = null;
const CACHE_MS = 60_000;

/** All variants of the product, keyed by "size|finish". Cached for a minute. */
export async function getCatalog(handle: string, { fresh = false } = {}): Promise<Catalog> {
  if (!fresh && cache && cache.handle === handle && Date.now() - cache.at < CACHE_MS) return cache.catalog;
  const data = await storefrontQuery<ProductData>(PRODUCT_QUERY, { handle });
  if (!data.product) {
    throw new ShopifyError(`Product "${handle}" not found. Is it published to the Headless channel?`);
  }
  const variants: Record<string, CatalogVariant> = {};
  for (const v of data.product.variants.nodes) {
    const size = v.selectedOptions.find((o) => o.name === SIZE_OPTION)?.value;
    const finish = v.selectedOptions.find((o) => o.name === FINISH_OPTION)?.value;
    if (!size || !finish) continue;
    variants[variantKey(size, finish)] = { id: v.id, size, finish, price: v.price, availableForSale: v.availableForSale };
  }
  const catalog = { variants };
  cache = { at: Date.now(), handle, catalog };
  return catalog;
}

// ---- Cart ------------------------------------------------------------------

const CART_CREATE = /* GraphQL */ `
  mutation CartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        lines(first: 5) { nodes { quantity merchandise { ... on ProductVariant { id } } } }
      }
      userErrors { code field message }
      warnings { code message target }
    }
  }
`;

interface CartCreateData {
  cartCreate: {
    cart: {
      id: string;
      checkoutUrl: string;
      lines: { nodes: { quantity: number; merchandise: { id?: string } }[] };
    } | null;
    userErrors: { code: string | null; field: string[] | null; message: string }[];
    warnings: { code: string; message: string; target: string }[];
  };
}

export type CartResult =
  | { ok: true; cartId: string; checkoutUrl: string }
  | { ok: false; reason: "out_of_stock" | "rejected"; message: string };

const STOCK_WARNINGS = new Set(["MERCHANDISE_OUT_OF_STOCK", "MERCHANDISE_NOT_ENOUGH_STOCK"]);

/** Creates a one-line cart carrying only the receipt ID as a line attribute. */
export async function createCart(
  { variantId, attributeKey, receiptId }: { variantId: string; attributeKey: string; receiptId: string },
  opts: { buyerIp?: string | null } = {},
): Promise<CartResult> {
  const data = await storefrontQuery<CartCreateData>(
    CART_CREATE,
    {
      input: {
        lines: [{ merchandiseId: variantId, quantity: 1, attributes: [{ key: attributeKey, value: receiptId }] }],
      },
    },
    opts,
  );
  const { cart, userErrors, warnings } = data.cartCreate;

  if (userErrors.length) {
    log.warn("cart.user_errors", { receiptId, userErrors });
    return { ok: false, reason: "rejected", message: userErrors.map((e) => e.message).join("; ") };
  }
  const stock = warnings.find((w) => STOCK_WARNINGS.has(w.code));
  // A stock problem still returns a cart, minus (or short of) the line.
  const line = cart?.lines.nodes.find((l) => l.merchandise.id === variantId);
  if (stock || !line || line.quantity < 1) {
    log.warn("cart.out_of_stock", { receiptId, variantId, warnings });
    return { ok: false, reason: "out_of_stock", message: stock?.message ?? "This option is unavailable" };
  }
  if (!cart) return { ok: false, reason: "rejected", message: "Shopify did not return a cart" };
  return { ok: true, cartId: cart.id, checkoutUrl: cart.checkoutUrl };
}

const CART_QUERY = /* GraphQL */ `
  query Cart($id: ID!) {
    cart(id: $id) { id checkoutUrl totalQuantity }
  }
`;

/** A fresh checkout URL for an existing cart, or null if the cart has expired or emptied. */
export async function refreshCheckoutUrl(cartId: string, opts: { buyerIp?: string | null } = {}) {
  const data = await storefrontQuery<{ cart: { checkoutUrl: string; totalQuantity: number } | null }>(
    CART_QUERY,
    { id: cartId },
    opts,
  );
  return data.cart && data.cart.totalQuantity > 0 ? data.cart.checkoutUrl : null;
}
