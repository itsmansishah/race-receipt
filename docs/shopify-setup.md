# Shopify setup and test orders

This connects Race Receipt to a Shopify **development store**, then walks through one complete test order. You put every credential into `.env.local` yourself; it is git-ignored and never sent to the browser.

Shopify's own screens change from time to time. If a label below doesn't match exactly, look for the nearest equivalent.

## What you'll end up with

| Variable | Where it comes from | Secret? |
| --- | --- | --- |
| `SHOPIFY_STORE_DOMAIN` | Your dev store, e.g. `race-receipt-dev.myshopify.com` | No |
| `SHOPIFY_STOREFRONT_PUBLIC_TOKEN` | Headless channel → storefront → Storefront API | No (browser-safe, not used yet) |
| `SHOPIFY_STOREFRONT_PRIVATE_TOKEN` | Headless channel → storefront → Storefront API | **Yes** |
| `SHOPIFY_CLIENT_ID` | Dev Dashboard → your app → Settings | No |
| `SHOPIFY_CLIENT_SECRET` | Dev Dashboard → your app → Settings | **Yes**: also signs webhooks |
| `RENDER_SECRET` | You generate it: `openssl rand -base64 32` | **Yes** |

**Why there's no "Admin API token":** Shopify no longer lets you create apps inside the store admin, which is where a pasted Admin token used to come from. Apps now live in the Dev Dashboard. Our server swaps the Client ID and secret for a 24-hour Admin token automatically (the *client credentials grant*). This only works when the app and the store are in the **same organization**, which is why step 1 creates the store from the Dev Dashboard.

## 1. Create a development store

1. Go to **dev.shopify.com** and sign in. Create an organization if it asks.
2. Open **Dev stores** → **Create store**. Name it something like `race-receipt-dev`.
3. Note the store's `….myshopify.com` domain. That's `SHOPIFY_STORE_DOMAIN`.

## 2. Create the app (Admin API access and webhooks)

1. In the Dev Dashboard, open **Apps** → **Create app**, choose to start from the Dev Dashboard (not the CLI), and name it `Race Receipt`.
2. In the app's configuration or version settings, set:
   - **App URL**: `http://localhost:3000` (required by the form; not used by this integration).
   - **Access scopes**: `read_orders` (receive `orders/paid`, run reconciliation) and `read_products` (setup check).
3. **Release** that version.
4. **Install** the app on `race-receipt-dev` and approve the scopes.
5. Open the app's **Settings** and copy **Client ID** → `SHOPIFY_CLIENT_ID` and **Client secret** → `SHOPIFY_CLIENT_SECRET`.

## 3. Get Storefront API tokens (Headless channel)

1. In the store admin (`https://<your-store>.myshopify.com/admin`), install the **Headless** sales channel from the Shopify App Store.
2. In Headless, **Create storefront** (name it `Race Receipt site`).
3. Open the storefront's **Storefront API** settings:
   - Copy the **public access token** → `SHOPIFY_STOREFRONT_PUBLIC_TOKEN`.
   - Copy the **private access token** → `SHOPIFY_STOREFRONT_PRIVATE_TOKEN`.
   - Under **permissions**, make sure these are on: read product listings (`unauthenticated_read_product_listings`), write checkouts (`unauthenticated_write_checkouts`), read checkouts (`unauthenticated_read_checkouts`).

## 4. Create the placeholder product

One product, 21 variants. The option names and values must match exactly; the app finds variants by them.

1. **Products** → **Add product**. Title: `Race Receipt`.
2. Check the handle (under *Search engine listing*) is `race-receipt`, or set `SHOPIFY_PRODUCT_HANDLE` to match.
3. Add two options:
   - **Size**: `8x10`, `11x14`, `12x18`
   - **Finish**: `Unframed`, `Black frame`, `Oak frame`, `White frame`, `Black frame + mat`, `Oak frame + mat`, `White frame + mat`
4. Set a price on each variant. To match the customizer's placeholders: 8x10 = $39, 11x14 = $59, 12x18 = $79; add $60 for a frame and $80 for a frame with mat.
5. **Inventory**: turn off **Track quantity** for every variant. Prints are made to order, so they never "sell out" unless you turn tracking back on.
6. **Shipping**: mark it as a physical product and give it a weight.
7. **Publishing**: make the product available on the **Headless** storefront, and set status to **Active**.
8. **Settings → Shipping and delivery**: make sure there's a shipping rate for your test address's country.

## 5. Turn on test payments

**Settings → Payments** → choose a provider → **Test payment gateway** (formerly "Bogus Gateway") → **Activate**. If another card provider is active, deactivate it first.

At checkout, pay with:

| Field | Value |
| --- | --- |
| Card number | `1` approves · `2` declines · `3` gateway failure |
| Name on card | `Test payment gateway` |
| Expiry | any future date |
| Security code | any 3 digits, e.g. `111` |

Test orders must total more than the equivalent of US $1.

## 6. Configure and start everything locally

```bash
cp .env.example .env.local      # then fill in the values from steps 1–3
openssl rand -base64 32         # paste the output as RENDER_SECRET
npx playwright install chromium # one-time: the renderer's headless browser
brew install cloudflared        # one-time: a public HTTPS URL for webhooks
```

Run each of these in its own terminal:

```bash
npm run dev                                   # 1. the site, http://localhost:3000
npm run worker                                # 2. renders paid receipts
cloudflared tunnel --url http://localhost:3000  # 3. prints https://<random>.trycloudflare.com
```

Then point Shopify's `orders/paid` webhook at the tunnel, and check the whole setup:

```bash
npm run shopify:webhook -- https://<random>.trycloudflare.com
npm run shopify:check
```

`shopify:check` should end with **All good.** A quick tunnel's URL changes every time you restart `cloudflared`; rerun `shopify:webhook` when it does.

## 7. One full test order, stage by stage

Send it as a gift so the recipient path gets tested too.

| # | Do this | Where to see it |
| --- | --- | --- |
| 1 | Open `http://localhost:3000`. In **01**, choose *A gift for someone*, enter a recipient name and a gift message. Design anything. | The live preview. Prices in **07** and the bottom bar now come from Shopify (no "estimated" note in the order summary). |
| 2 | **Review order** → **Secure checkout**. | Terminal 1: `checkout.started` with a `receiptId`. Database: `sqlite3 data/race-receipt.db "select id, status, cart_id from receipts order by created_at desc limit 1"` → `pending_payment`. |
| 3 | You land on Shopify's hosted checkout. Enter an email, then the **recipient's** name and address as the shipping address. Pay with card `1`. | Shopify's thank-you page. |
| 4 | — | Store admin → **Orders**: the new order, marked as a test order. The line item carries `_receipt_id` (the leading underscore hides it from the buyer, but staff can see it). |
| 5 | — | Terminal 3 (`cloudflared`): a `POST /api/webhooks/shopify/orders-paid`. Terminal 1: `webhook.processed`. Database: `select * from webhook_deliveries` → `processed`; the receipt is now `paid` with the order name and shipping address. |
| 6 | — | Terminal 2: `render.done` with `width: 3300, height: 4200` for 11×14 (2400×3000 for 8×10, 3600×5400 for 12×18), then `fulfillment.stub`. |
| 7 | Open the outputs. | `storage/prints/<receiptId>.png`: the print file at 300 DPI. `storage/packing-slips/<receiptId>.txt` and `.json`: shipping to the recipient, the gift message, no prices. Receipt status: `awaiting_fulfillment`. |

### Also worth trying

- **Abandoned checkout:** click **Secure checkout**, then use the browser's back button (or close the tab and reopen the site). A banner says your design is saved and offers **Finish checkout**, which opens a fresh checkout link for the same receipt.
- **Declined card:** pay with `2`. Shopify shows the decline. No order is created and no webhook arrives.
- **Sold out:** turn **Track quantity** on for one variant with 0 stock. That size and finish shows "Sold out" and checkout explains why, keeping the design.
- **Duplicate delivery:** `npm run simulate:paid -- 11x14 dup` sends the same signed webhook twice. The second gets `{"duplicate":true}` and only one print is rendered. (The simulator also lets you test the worker and renderer without Shopify at all.)
- **Missed webhooks:** `npm run reconcile` asks Shopify for paid orders from the last 3 days and processes any we missed. Safe to run any time.

## Where things live

| What | Where |
| --- | --- |
| Saved designs, order state | `data/race-receipt.db` (SQLite; tables `receipts`, `webhook_deliveries`, `jobs`) |
| Dithered photos | `storage/photos/`: deleted 90 days after an order is fulfilled |
| Print files | `storage/prints/` |
| Packing slips | `storage/packing-slips/` |
| Logs | Terminal output, one JSON line per event; failures are `"level":"error"` |
| Fulfillment hand-off | `lib/server/fulfillment.ts`: **stub**, logs only |

## Before going live

- Move from SQLite and local files to Postgres and object storage, and run the worker on a host that can run headless Chromium.
- Subscribe to `orders/paid` as an app-level subscription (in the app's configuration) instead of the per-store one `shopify:webhook` creates. Shopify deletes per-store subscriptions after 8 consecutive failed deliveries.
- Run `npm run reconcile` on a schedule.
- Replace the fulfillment stub.
- Add rate limiting to `POST /api/checkout`.
