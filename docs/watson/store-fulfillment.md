# Watson — Store Fulfillment

Watson stores **internal** drop-ship shipping history for knitting machines, ribbers, and related physical products. Shopify remains the source of truth for customer-facing fulfillment status and tracking emails.

## Intended workflow

1. Supplier sends a shipping invoice.
2. Fulfill the Shopify order and add tracking in Shopify.
3. Open the customer in Watson (legacy or Memberstack profile).
4. In **Store Fulfillment**, record actual shipping cost, supplier invoice, carrier, tracking number, boxes, and ship date.
5. Use Watson later for shipping-cost reporting (averages by product, supplier, carrier, boxes, destination, and trends).

## Data

Table: `watson_store_fulfillments` (Watson-native Postgres; not part of the legacy CSV import).

Customer linking uses the same `memberid` / dual-ID pattern as Watson Notes (`notesWriteId` for writes; linked Memberstack + legacy IDs for reads).

Shopify order number may still be entered manually for shipping-cost records. Live Shopify order headers/line items sync separately into `watson_shopify_*` (see [shopify-sales.md](./shopify-sales.md)); DesignaKnit license numbers are stored on `watson_dak_licenses`, not on this shipping table. Watson does **not** change Shopify fulfillment status.

## Apply schema to an existing Watson database

Legacy import does not create this table. Apply once:

```bash
psql "$WATSON_DATABASE_URL" -f scripts/sql/watson-store-fulfillments.sql
```

Or run the SQL from `scripts/sql/watson-store-fulfillments.sql` in the Supabase SQL editor. The script is idempotent (`IF NOT EXISTS`).

Canonical statement builders also live in `src/lib/watson/schema.ts` (`getWatsonNativeSchemaStatements`) and are reflected in `src/lib/watson/schema.sql` via `npm run watson:generate-schema`.
