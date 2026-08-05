import path from "path";
import { fileURLToPath } from "url";

import { WATSON_DB_STATEMENT_TIMEOUT_MS } from "./env";
import { LEGACY_TABLE_DEFINITIONS } from "./tableDefinitions";
import type { LegacyTableDef, PgColumnType } from "./types";

// Do NOT name this `__dirname`: Netlify's function bundler injects its own
// top-level `__dirname` shim, and a same-named const here collides with
// "Identifier '__dirname' has already been declared" at module init.
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

export interface SchemaStatement {
  label: string;
  sql: string;
}

export interface BlockingImportSession {
  pid: number;
  state: string;
  durationMs: number;
  queryPreview: string;
}

function pgTypeSql(type: PgColumnType): string {
  switch (type) {
    case "text":
      return "TEXT";
    case "integer":
      return "INTEGER";
    case "bigint":
      return "BIGINT";
    case "numeric":
      return "NUMERIC(12, 4)";
    case "date":
      return "DATE";
    case "timestamptz":
      return "TIMESTAMPTZ";
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

export function buildCreateTableSql(def: LegacyTableDef): string {
  const columnSql = def.columns
    .map((column) => {
      const nullSql = column.nullable === false ? "NOT NULL" : "";
      return `  ${quoteIdent(column.pg)} ${pgTypeSql(column.type)} ${nullSql}`.trim();
    })
    .join(",\n");

  const pk = def.primaryKey.map(quoteIdent).join(", ");
  return [
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(def.pgTable)} (`,
    columnSql + ",",
    `  PRIMARY KEY (${pk})`,
    ")",
  ].join("\n");
}

export function getLegacyTableSchemaStatements(
  definitions: LegacyTableDef[] = LEGACY_TABLE_DEFINITIONS,
): SchemaStatement[] {
  return definitions.map((def) => ({
    label: `table ${def.pgTable}`,
    sql: buildCreateTableSql(def),
  }));
}

export function getWatsonNativeSchemaStatements(): SchemaStatement[] {
  return [
    {
      label: "table watson_notes",
      sql: `CREATE TABLE IF NOT EXISTS watson_notes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  memberid TEXT NOT NULL,
  note_text TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('General', 'Course', 'Membership', 'Payment', 'Support')),
  created_by TEXT NOT NULL DEFAULT 'Sue',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
)`,
    },
    {
      label: "index idx_watson_notes_memberid_created",
      sql: "CREATE INDEX IF NOT EXISTS idx_watson_notes_memberid_created ON watson_notes (memberid, created_at DESC)",
    },
    {
      label: "table watson_store_fulfillments",
      sql: `CREATE TABLE IF NOT EXISTS watson_store_fulfillments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  memberid TEXT NOT NULL,
  shopify_order_id TEXT,
  shopify_order_number TEXT NOT NULL,
  product_description TEXT NOT NULL,
  product_variant_id TEXT,
  supplier TEXT NOT NULL,
  carrier TEXT NOT NULL,
  tracking_number TEXT,
  actual_shipping_cost NUMERIC(12, 4) NOT NULL CHECK (actual_shipping_cost >= 0),
  customer_shipping_charge NUMERIC(12, 4) CHECK (customer_shipping_charge IS NULL OR customer_shipping_charge >= 0),
  box_count INTEGER NOT NULL DEFAULT 1 CHECK (box_count >= 1),
  ship_date DATE NOT NULL,
  supplier_invoice_number TEXT,
  destination_state TEXT,
  destination_postal TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
)`,
    },
    {
      label: "index idx_watson_store_fulfillments_shopify_order_id",
      sql: "CREATE INDEX IF NOT EXISTS idx_watson_store_fulfillments_shopify_order_id ON watson_store_fulfillments (shopify_order_id)",
    },
    {
      label: "index idx_watson_store_fulfillments_memberid_ship_date",
      sql: "CREATE INDEX IF NOT EXISTS idx_watson_store_fulfillments_memberid_ship_date ON watson_store_fulfillments (memberid, ship_date DESC)",
    },
    {
      label: "index idx_watson_store_fulfillments_ship_date",
      sql: "CREATE INDEX IF NOT EXISTS idx_watson_store_fulfillments_ship_date ON watson_store_fulfillments (ship_date)",
    },
    {
      label: "index idx_watson_store_fulfillments_supplier",
      sql: "CREATE INDEX IF NOT EXISTS idx_watson_store_fulfillments_supplier ON watson_store_fulfillments (supplier)",
    },
    {
      label: "index idx_watson_store_fulfillments_product",
      sql: "CREATE INDEX IF NOT EXISTS idx_watson_store_fulfillments_product ON watson_store_fulfillments (product_description)",
    },
    {
      label: "index idx_watson_store_fulfillments_shopify_order_number",
      sql: "CREATE INDEX IF NOT EXISTS idx_watson_store_fulfillments_shopify_order_number ON watson_store_fulfillments (shopify_order_number)",
    },
    {
      label: "index idx_watson_store_fulfillments_order_tracking_unique",
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_watson_store_fulfillments_order_tracking_unique
ON watson_store_fulfillments (shopify_order_number, tracking_number)
WHERE tracking_number IS NOT NULL AND BTRIM(tracking_number) <> ''`,
    },
    {
      label: "table watson_shopify_orders",
      sql: `CREATE TABLE IF NOT EXISTS watson_shopify_orders (
  shopify_order_id TEXT PRIMARY KEY,
  shopify_order_gid TEXT,
  order_number TEXT NOT NULL,
  order_name TEXT,
  processed_at TIMESTAMPTZ,
  created_at_shopify TIMESTAMPTZ,
  customer_first_name TEXT,
  customer_last_name TEXT,
  customer_email TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal_amount NUMERIC(12, 4) NOT NULL DEFAULT 0,
  total_discounts NUMERIC(12, 4) NOT NULL DEFAULT 0,
  total_tax NUMERIC(12, 4) NOT NULL DEFAULT 0,
  total_shipping NUMERIC(12, 4) NOT NULL DEFAULT 0,
  total_price NUMERIC(12, 4) NOT NULL DEFAULT 0,
  total_refunded NUMERIC(12, 4) NOT NULL DEFAULT 0,
  financial_status TEXT,
  fulfillment_status TEXT,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  tags TEXT,
  site_brand TEXT NOT NULL CHECK (site_brand IN ('knit_it_now', 'designaknit')),
  is_designaknit BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL DEFAULT 'shopify',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
)`,
    },
    {
      label: "index idx_watson_shopify_orders_processed_at",
      sql: "CREATE INDEX IF NOT EXISTS idx_watson_shopify_orders_processed_at ON watson_shopify_orders (processed_at DESC NULLS LAST)",
    },
    {
      label: "index idx_watson_shopify_orders_email",
      sql: "CREATE INDEX IF NOT EXISTS idx_watson_shopify_orders_email ON watson_shopify_orders (lower(customer_email))",
    },
    {
      label: "index idx_watson_shopify_orders_order_number",
      sql: "CREATE INDEX IF NOT EXISTS idx_watson_shopify_orders_order_number ON watson_shopify_orders (order_number)",
    },
    {
      label: "index idx_watson_shopify_orders_site_brand",
      sql: "CREATE INDEX IF NOT EXISTS idx_watson_shopify_orders_site_brand ON watson_shopify_orders (site_brand)",
    },
    {
      label: "table watson_shopify_order_items",
      sql: `CREATE TABLE IF NOT EXISTS watson_shopify_order_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  shopify_order_id TEXT NOT NULL REFERENCES watson_shopify_orders (shopify_order_id) ON DELETE CASCADE,
  shopify_line_item_id TEXT NOT NULL,
  title TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  sku TEXT,
  variant_title TEXT,
  vendor TEXT,
  product_id TEXT,
  product_handle TEXT,
  unit_price NUMERIC(12, 4),
  UNIQUE (shopify_order_id, shopify_line_item_id)
)`,
    },
    {
      label: "index idx_watson_shopify_order_items_order_id",
      sql: "CREATE INDEX IF NOT EXISTS idx_watson_shopify_order_items_order_id ON watson_shopify_order_items (shopify_order_id)",
    },
    {
      label: "index idx_watson_shopify_order_items_title",
      sql: "CREATE INDEX IF NOT EXISTS idx_watson_shopify_order_items_title ON watson_shopify_order_items (title)",
    },
    {
      label: "table watson_shopify_sync_runs",
      sql: `CREATE TABLE IF NOT EXISTS watson_shopify_sync_runs (
  id BIGSERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  trigger_source TEXT NOT NULL DEFAULT 'manual',
  lookback_days INTEGER NOT NULL DEFAULT 90,
  orders_fetched INTEGER NOT NULL DEFAULT 0,
  orders_added INTEGER NOT NULL DEFAULT 0,
  orders_updated INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
)`,
    },
    {
      label: "index idx_watson_shopify_sync_runs_started",
      sql: "CREATE INDEX IF NOT EXISTS idx_watson_shopify_sync_runs_started ON watson_shopify_sync_runs (started_at DESC)",
    },
    {
      label: "table watson_dak_licenses",
      sql: `CREATE TABLE IF NOT EXISTS watson_dak_licenses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  shopify_order_id TEXT NOT NULL UNIQUE REFERENCES watson_shopify_orders (shopify_order_id) ON DELETE CASCADE,
  shopify_order_number TEXT NOT NULL,
  customer_email TEXT,
  customer_name TEXT,
  product_title TEXT,
  license_number TEXT,
  license_assigned_date DATE,
  fulfillment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (fulfillment_status IN ('pending', 'assigned', 'delivered')),
  internal_notes TEXT,
  memberid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
)`,
    },
    {
      label: "index idx_watson_dak_licenses_order_number",
      sql: "CREATE INDEX IF NOT EXISTS idx_watson_dak_licenses_order_number ON watson_dak_licenses (shopify_order_number)",
    },
    {
      label: "table watson_legacy_renewal_reminders",
      sql: `CREATE TABLE IF NOT EXISTS watson_legacy_renewal_reminders (
  id BIGSERIAL PRIMARY KEY,
  as_of_date DATE NOT NULL,
  window_days SMALLINT NOT NULL CHECK (window_days IN (30, 7, 1)),
  tag_name TEXT NOT NULL,
  legacy_memberid TEXT NOT NULL,
  email TEXT,
  paid_through DATE,
  memberstack_id TEXT,
  memberstack_resolution TEXT,
  ac_contact_id TEXT,
  list_status TEXT,
  outcome TEXT NOT NULL,
  dry_run BOOLEAN NOT NULL DEFAULT FALSE,
  trigger_source TEXT NOT NULL DEFAULT 'manual',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
    },
    {
      label: "index idx_watson_legacy_renewal_reminders_tagged_unique",
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_watson_legacy_renewal_reminders_tagged_unique
ON watson_legacy_renewal_reminders (legacy_memberid, tag_name)
WHERE outcome = 'tagged' AND dry_run = FALSE`,
    },
    {
      label: "index idx_watson_legacy_renewal_reminders_as_of",
      sql: "CREATE INDEX IF NOT EXISTS idx_watson_legacy_renewal_reminders_as_of ON watson_legacy_renewal_reminders (as_of_date, window_days)",
    },
    {
      label: "index idx_watson_legacy_renewal_reminders_memberid",
      sql: "CREATE INDEX IF NOT EXISTS idx_watson_legacy_renewal_reminders_memberid ON watson_legacy_renewal_reminders (legacy_memberid)",
    },
    {
      label: "table watson_whats_new_cards",
      sql: `CREATE TABLE IF NOT EXISTS watson_whats_new_cards (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('tool', 'pattern', 'resource', 'learning', 'improvement')),
  destination_url TEXT,
  button_text TEXT,
  board_column TEXT NOT NULL CHECK (board_column IN ('just_added', 'worth_exploring', 'in_the_pipeline')),
  publish_date DATE NOT NULL DEFAULT CURRENT_DATE,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  display_order INTEGER NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
    },
    {
      label: "index idx_watson_whats_new_cards_public",
      sql: `CREATE INDEX IF NOT EXISTS idx_watson_whats_new_cards_public
ON watson_whats_new_cards (board_column, display_order, publish_date DESC)
WHERE status = 'published' AND archived = FALSE`,
    },
    {
      label: "index idx_watson_whats_new_cards_admin",
      sql: "CREATE INDEX IF NOT EXISTS idx_watson_whats_new_cards_admin ON watson_whats_new_cards (archived, board_column, display_order, publish_date DESC)",
    },
    {
      label: "table watson_whats_new_settings",
      sql: `CREATE TABLE IF NOT EXISTS watson_whats_new_settings (
  key TEXT PRIMARY KEY,
  headline TEXT NOT NULL DEFAULT '',
  introduction TEXT NOT NULL DEFAULT '',
  original_video_url TEXT,
  safe_vimeo_embed_url TEXT,
  publish_date DATE,
  button_text TEXT,
  button_destination_url TEXT,
  start_date DATE,
  end_date DATE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
    },
    {
      label: "alter watson_whats_new_settings billboard columns",
      sql: `ALTER TABLE watson_whats_new_settings
  ADD COLUMN IF NOT EXISTS button_text TEXT,
  ADD COLUMN IF NOT EXISTS button_destination_url TEXT,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE`,
    },
    {
      label: "table watson_tip_of_the_week",
      sql: `CREATE TABLE IF NOT EXISTS watson_tip_of_the_week (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tip_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  intro TEXT NOT NULL,
  video_content_id TEXT NOT NULL,
  available_from DATE NOT NULL,
  available_through DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'active', 'archived')),
  availability_notice TEXT NOT NULL DEFAULT 'Free to watch this week',
  availability_footer_template TEXT NOT NULL DEFAULT
    'This Learning Library video is free for everyone through {date}. After that, it returns to the member Learning Library.',
  try_copy TEXT NOT NULL DEFAULT '',
  sue_tip_copy TEXT NOT NULL DEFAULT '',
  learn_points_json TEXT NOT NULL DEFAULT '[]',
  related_links_json TEXT NOT NULL DEFAULT '[]',
  eyebrow TEXT NOT NULL DEFAULT 'TIP OF THE WEEK',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT watson_tip_of_the_week_dates_ok
    CHECK (available_from <= available_through)
)`,
    },
    {
      label: "index idx_watson_tip_of_the_week_public",
      sql: `CREATE INDEX IF NOT EXISTS idx_watson_tip_of_the_week_public
ON watson_tip_of_the_week (status, available_from, available_through)
WHERE status IN ('scheduled', 'active')`,
    },
    {
      label: "index idx_watson_tip_of_the_week_admin",
      sql: `CREATE INDEX IF NOT EXISTS idx_watson_tip_of_the_week_admin
ON watson_tip_of_the_week (status, available_from DESC, updated_at DESC)`,
    },
    {
      label: "table watson_email_signups",
      sql: `CREATE TABLE IF NOT EXISTS watson_email_signups (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('added', 'already-subscribed', 'not-added', 'failed')),
  outcome TEXT,
  error_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
    },
    {
      label: "index idx_watson_email_signups_added_created",
      sql: `CREATE INDEX IF NOT EXISTS idx_watson_email_signups_added_created
ON watson_email_signups (created_at)
WHERE status = 'added'`,
    },
    {
      label: "index idx_watson_email_signups_source_created",
      sql: "CREATE INDEX IF NOT EXISTS idx_watson_email_signups_source_created ON watson_email_signups (source, created_at)",
    },
    {
      label: "index idx_watson_email_signups_status_created",
      sql: "CREATE INDEX IF NOT EXISTS idx_watson_email_signups_status_created ON watson_email_signups (status, created_at)",
    },
  ];
}

export function getLegacyMetadataSchemaStatements(): SchemaStatement[] {
  return [
    {
      label: "table watson_import_runs",
      sql: `CREATE TABLE IF NOT EXISTS watson_import_runs (
  id BIGSERIAL PRIMARY KEY,
  batch_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'dry-run')),
  error_message TEXT
)`,
    },
    {
      label: "table watson_import_run_tables",
      sql: `CREATE TABLE IF NOT EXISTS watson_import_run_tables (
  import_run_id BIGINT NOT NULL REFERENCES watson_import_runs(id) ON DELETE CASCADE,
  pg_table TEXT NOT NULL,
  export_name TEXT NOT NULL,
  csv_path TEXT NOT NULL,
  csv_row_count INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  reject_file TEXT,
  PRIMARY KEY (import_run_id, pg_table)
)`,
    },
  ];
}

export function getLegacyIndexSchemaStatements(): SchemaStatement[] {
  return [
    {
      label: "index idx_legacy_members_email",
      sql: "CREATE INDEX IF NOT EXISTS idx_legacy_members_email ON legacy_members (LOWER(email))",
    },
    {
      label: "index idx_legacy_members_lastname",
      sql: "CREATE INDEX IF NOT EXISTS idx_legacy_members_lastname ON legacy_members (lastname)",
    },
    {
      label: "index idx_legacy_members_fristname",
      sql: "CREATE INDEX IF NOT EXISTS idx_legacy_members_fristname ON legacy_members (fristname)",
    },
    {
      label: "index idx_legacy_subscriptions_memberid",
      sql: "CREATE INDEX IF NOT EXISTS idx_legacy_subscriptions_memberid ON legacy_subscriptions (memberid_fk)",
    },
    {
      label: "index idx_legacy_store_transactions_memberid",
      sql: "CREATE INDEX IF NOT EXISTS idx_legacy_store_transactions_memberid ON legacy_store_transactions (memberid_fk)",
    },
    {
      label: "index idx_legacy_store_transaction_items_storetransactionid",
      sql: "CREATE INDEX IF NOT EXISTS idx_legacy_store_transaction_items_storetransactionid ON legacy_store_transaction_items (storetransactionid)",
    },
    {
      label: "index idx_legacy_course_member_library_memberid",
      sql: "CREATE INDEX IF NOT EXISTS idx_legacy_course_member_library_memberid ON legacy_course_member_library (memberid_fk)",
    },
    {
      label: "index idx_legacy_member_pattern_details_member",
      sql: "CREATE INDEX IF NOT EXISTS idx_legacy_member_pattern_details_member ON legacy_member_pattern_details (member_fk)",
    },
    {
      label: "index idx_legacy_pattern_library_purchases_member",
      sql: "CREATE INDEX IF NOT EXISTS idx_legacy_pattern_library_purchases_member ON legacy_pattern_library_purchases (memberid_fk)",
    },
  ];
}

export function getLegacySchemaStatements(
  definitions: LegacyTableDef[] = LEGACY_TABLE_DEFINITIONS,
): SchemaStatement[] {
  return [
    ...getLegacyTableSchemaStatements(definitions),
    ...getLegacyMetadataSchemaStatements(),
    ...getWatsonNativeSchemaStatements(),
    ...getLegacyIndexSchemaStatements(),
  ];
}

export function buildLegacySchemaSql(definitions: LegacyTableDef[]): string {
  return `${getLegacySchemaStatements(definitions)
    .map((statement) => `${statement.sql};`)
    .join("\n\n")}\n`;
}

export function getLegacySchemaSqlPath(): string {
  return path.join(moduleDirectory, "schema.sql");
}

export function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function formatBlockingImportSessionsMessage(
  sessions: BlockingImportSession[],
): string {
  const details = sessions
    .map(
      (session) =>
        `pid ${session.pid} (${session.state}, ${Math.round(session.durationMs / 1000)}s): ${session.queryPreview}`,
    )
    .join("; ");
  return (
    "Another Watson import connection is holding database locks (idle in transaction). " +
    "In Supabase Dashboard > Database > SQL Editor, run SELECT pg_terminate_backend(<pid>) for each blocking pid, then retry. " +
    `Blocking session(s): ${details}`
  );
}

export async function findBlockingImportSessions(client: {
  query: (sql: string) => Promise<{ rows: Array<Record<string, unknown>> }>;
}): Promise<BlockingImportSession[]> {
  const result = await client.query(`
    SELECT
      pid,
      state,
      EXTRACT(EPOCH FROM (now() - state_change)) * 1000 AS duration_ms,
      LEFT(query, 160) AS query_preview
    FROM pg_stat_activity
    WHERE datname = current_database()
      AND pid <> pg_backend_pid()
      AND state = 'idle in transaction'
      AND (
        query ILIKE '%legacy_%'
        OR query ILIKE '%watson_import_%'
        OR query = 'BEGIN'
      )
    ORDER BY state_change
  `);

  return result.rows.map((row) => ({
    pid: Number(row.pid),
    state: String(row.state),
    durationMs: Number(row.duration_ms ?? 0),
    queryPreview: String(row.query_preview ?? "").replace(/\s+/g, " ").trim(),
  }));
}

export async function configureImportSession(client: {
  query: (sql: string) => Promise<unknown>;
}): Promise<void> {
  if (WATSON_DB_STATEMENT_TIMEOUT_MS === 0) {
    await client.query("SET statement_timeout TO 0");
  } else {
    await client.query(`SET statement_timeout TO ${WATSON_DB_STATEMENT_TIMEOUT_MS}`);
  }
  await client.query("SET lock_timeout TO 60000");
}

export async function applySchemaStatements(
  client: { query: (sql: string) => Promise<unknown> },
  statements: SchemaStatement[],
  onProgress?: (message: string) => void,
): Promise<void> {
  for (const statement of statements) {
    onProgress?.(`Schema statement started: ${statement.label}`);
    try {
      await client.query(`${statement.sql};`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Schema statement failed (${statement.label}): ${detail}`);
    }
    onProgress?.(`Schema statement completed: ${statement.label}`);
  }
}

export async function applyLegacySchema(
  client: { query: (sql: string) => Promise<unknown> },
  options: {
    onProgress?: (message: string) => void;
    definitions?: LegacyTableDef[];
  } = {},
): Promise<void> {
  const statements = [
    ...getLegacyTableSchemaStatements(options.definitions),
    ...getLegacyMetadataSchemaStatements(),
  ];
  await applySchemaStatements(client, statements, options.onProgress);
}

export async function applyLegacyIndexes(
  client: { query: (sql: string) => Promise<unknown> },
  options: { onProgress?: (message: string) => void } = {},
): Promise<void> {
  options.onProgress?.("Index creation started...");
  await applySchemaStatements(client, getLegacyIndexSchemaStatements(), options.onProgress);
  options.onProgress?.("Index creation completed.");
}

export async function applyWatsonNativeSchema(
  client: { query: (sql: string) => Promise<unknown> },
  options: { onProgress?: (message: string) => void } = {},
): Promise<void> {
  await applySchemaStatements(client, getWatsonNativeSchemaStatements(), options.onProgress);
}

export async function truncateLegacyTables(
  client: { query: (sql: string) => Promise<unknown> },
  pgTables: string[],
): Promise<void> {
  if (pgTables.length === 0) {
    return;
  }
  const tableList = pgTables.map(quoteIdent).join(", ");
  await client.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`);
}
