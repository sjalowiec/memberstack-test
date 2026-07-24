# Watson — Live Shopify Recent Sales

Watson can sync **live Shopify orders** into Postgres and show them on **Recent Sales**. This path is separate from legacy ColdFusion CSV imports (`legacy_store_transactions`).

## What this is for

Sue can:

- See Shopify orders from at least the last 90 days
- Search by email, name, order number, or product title
- Filter by brand (Knit it Now vs DesignaKnit), payment/fulfillment status, product, date
- View money breakdowns and refund/cancel status
- Record DesignaKnit license numbers against an order
- Run **Sync Shopify Orders** manually (and rely on an optional Netlify schedule)

## Store layout

This installation uses **one Shopify store** (`vjzu11-86.myshopify.com` in current product links). Knit it Now merchandise and DesignaKnit software SKUs share that store.

**Learn DesignaKnit courses** are not sold through this Shopify store (Memberstack / learndesignaknit.com). Brand classification here means:

| `site_brand` | Meaning |
|---|---|
| `designaknit` | Order contains DesignaKnit software (handle/title/tags) — needs license ops |
| `knit_it_now` | Everything else on the Shopify store |

Classification rules live in `src/lib/watson/shopifyOrderClassify.ts` (known handles from `src/data/designaknit-products.json`, plus title/vendor/tag cues).

## Data model

Watson-native tables (not `legacy_*`):

| Table | Purpose |
|---|---|
| `watson_shopify_orders` | Order header; `source='shopify'`; unique `shopify_order_id` |
| `watson_shopify_order_items` | Line items; unique `(shopify_order_id, shopify_line_item_id)` |
| `watson_shopify_sync_runs` | Sync status / counts / errors |
| `watson_dak_licenses` | License number, assigned date, notes, status per DesignaKnit order |

Apply SQL once (or let sync apply native schema):

```bash
psql "$WATSON_DATABASE_URL" -f scripts/sql/watson-shopify-orders.sql
```

Canonical builders: `getWatsonNativeSchemaStatements()` in `src/lib/watson/schema.ts`.

## Credentials (Sue / ops)

Create a Shopify **custom app** on the store with Admin API scope:

- `read_orders` only (least privilege)

Set Netlify / `.env` (see `.env.example`):

| Variable | Required | Notes |
|---|---|---|
| `WATSON_DATABASE_URL` | Yes | Existing Watson Postgres |
| `SHOPIFY_STORE_DOMAIN` | Yes | e.g. `vjzu11-86.myshopify.com` |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | Yes | Admin API access token (`shpat_…`) |
| `SHOPIFY_API_VERSION` | No | Default `2025-01` |
| `WATSON_SHOPIFY_SYNC_SECRET` | No | If set, scheduled function requires `X-Watson-Sync-Secret` |

Tokens stay server-side only. Never expose them to the browser.

## Sync

- **Manual:** Watson ? Recent Sales ? **Sync Shopify Orders** ? `POST /api/watson/shopify/sync` (Watson session).
- **Scheduled:** Netlify function `watson-shopify-sync` every 6 hours (`netlify.toml`). Needs the same env vars on the Netlify site. There was no prior scheduled-function pattern in this repo; this uses Netlify’s supported `[functions."name"].schedule` cron.

Sync upserts by `shopify_order_id` (and replaces line items for that order), so re-runs do not duplicate orders.

## UI

| Path | Purpose |
|---|---|
| `/watson/sales` | Recent Sales: totals, filters, table, sync button |
| `/watson/sales/[orderId]` | Order detail + DesignaKnit license form |

Live rows show a **Live Shopify** badge. Legacy ColdFusion orders remain on member Orders / legacy reports only.

## DesignaKnit license workflow

1. Sync orders.
2. Filter brand = DesignaKnit (or open a DesignaKnit order).
3. **Record license** ? enter license number, assigned date, status, internal notes.
4. Optionally copy into Responses ? **DAK License Delivery**.

Physical machine shipping costs remain on customer **Store Fulfillment** (manual Shopify order number). License ops use `watson_dak_licenses` because store fulfillments are shipping-cost oriented and had no license fields.

## Distinction from legacy

| | Live Shopify | Legacy |
|---|---|---|
| Tables | `watson_shopify_*` | `legacy_store_transactions` |
| Ingest | Admin API sync | CSV import |
| UI | `/watson/sales` | Member Orders, Store Sales by Year |
| Badge | Live Shopify | (legacy context only) |
