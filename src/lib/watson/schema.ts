import path from "path";
import { fileURLToPath } from "url";

import { WATSON_DB_STATEMENT_TIMEOUT_MS } from "./env";
import { LEGACY_TABLE_DEFINITIONS } from "./tableDefinitions";
import type { LegacyTableDef, PgColumnType } from "./types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  return path.join(__dirname, "schema.sql");
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
