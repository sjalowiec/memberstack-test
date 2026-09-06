/**
 * Cleaned legacy garment-title lookup importer.
 * Default mode is dry-run (no Postgres writes). Writes require explicit --apply.
 * Never truncates or writes legacy_* dump tables.
 */
import fs from "node:fs";
import path from "node:path";

import { readCsvFile } from "./csvReader";
import { formatDatabaseTarget, WATSON_DB_CONNECTION_TIMEOUT_MS } from "./env";
import { buildMultiRowInsertSql } from "./importBatch";
import { applyWatsonLegacyGarmentsSchema, quoteIdent } from "./schema";
import { extractFilenameDate, getEffectiveSortTime } from "./resolveExportFiles";
import { cleanLegacyGarmentDescription } from "./legacyGarmentDescription";

const SAMPLE_LIMIT = 12;
const UPSERT_BATCH_SIZE = 500;
const GARMENTS_TABLE = "watson_legacy_garments";

const GARMENT_INSERT_COLUMNS = [
  "garment_id",
  "garment_title",
  "garment_description",
  "source_file",
  "batch_id",
] as const;

const GARMENT_UPDATE_COLUMNS = GARMENT_INSERT_COLUMNS.filter((column) => column !== "garment_id");

const GARMENTS_CSV_NAME_PATTERN = /^(legacy-garments|legacy_garments)(_.*)?\.csv$/i;

export type LegacyGarmentsQueryFn = (
  sql: string,
  params?: unknown[],
) => Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }>;

export type WatsonLegacyGarmentsRejectedRow = {
  lineNumber: number;
  reason: string;
  raw: string;
};

export type WatsonLegacyGarmentsWriteCounts = {
  csvRowCount: number;
  upserted: number;
  inserted: number;
  updated: number;
  skipped: number;
};

export type WatsonLegacyGarmentsDryRunReport = {
  mode: "dry-run";
  garmentsFile: string;
  csvRowCount: number;
  uniqueGarmentIdCount: number;
  preparedRowCount: number;
  duplicateGarmentIds: Array<{ garmentId: string; count: number }>;
  blankGarmentIdCount: number;
  blankGarmentTitleCount: number;
  descriptionCount: number;
  blankDescriptionCount: number;
  skippedDuplicateCount: number;
  rejectedRowCount: number;
  rejectedRows: WatsonLegacyGarmentsRejectedRow[];
  parseRejectedCount: number;
};

export type WatsonLegacyGarmentsApplyReport = {
  mode: "apply";
  status: "completed" | "aborted" | "failed";
  databaseTarget: string;
  garmentsFile: string;
  batchId: string;
  dryRun: WatsonLegacyGarmentsDryRunReport;
  garments: WatsonLegacyGarmentsWriteCounts;
  errorMessage?: string;
};

type PreparedGarmentRow = {
  garment_id: string;
  garment_title: string;
  garment_description: string | null;
  source_file: string;
  lineNumber: number;
};

type PreparedLegacyGarmentsImport = {
  dryRun: WatsonLegacyGarmentsDryRunReport;
  garments: PreparedGarmentRow[];
  skippedDuplicates: number;
};

function cell(row: Record<string, string>, header: string): string {
  const direct = row[header];
  if (direct != null) return direct;
  const match = Object.keys(row).find((key) => key.toLowerCase() === header.toLowerCase());
  return match ? row[match] : "";
}

function trimmed(row: Record<string, string>, header: string): string {
  return cell(row, header).trim();
}

function emptyWriteCounts(csvRowCount: number, skipped = 0): WatsonLegacyGarmentsWriteCounts {
  return {
    csvRowCount,
    upserted: 0,
    inserted: 0,
    updated: 0,
    skipped,
  };
}

export function resolveLegacyGarmentsCsvPath(options: {
  filePath?: string;
  dir?: string;
}): string {
  if (options.filePath?.trim()) {
    return path.resolve(options.filePath.trim());
  }

  const dir = path.resolve(options.dir?.trim() || "legacy-data/cleaned");
  const preferredNames = ["legacy-garments.csv", "legacy_garments.csv"];
  for (const name of preferredNames) {
    const preferred = path.join(dir, name);
    if (fs.existsSync(preferred)) {
      return preferred;
    }
  }

  if (!fs.existsSync(dir)) {
    throw new Error(`Legacy garments CSV directory does not exist: ${dir}`);
  }

  const matches = fs.readdirSync(dir).filter((name) => GARMENTS_CSV_NAME_PATTERN.test(name));
  if (matches.length === 0) {
    throw new Error(
      `No legacy garments CSV found in ${dir}. Expected legacy-garments.csv or legacy_garments_*.csv.`,
    );
  }

  matches.sort((a, b) => {
    const dateA = extractFilenameDate(a)?.getTime() ?? 0;
    const dateB = extractFilenameDate(b)?.getTime() ?? 0;
    if (dateA !== dateB) return dateB - dateA;
    return getEffectiveSortTime(path.join(dir, b), b) - getEffectiveSortTime(path.join(dir, a), a);
  });

  return path.join(dir, matches[0]);
}

export function prepareWatsonLegacyGarmentsImport(options: {
  garmentsPath: string;
}): PreparedLegacyGarmentsImport {
  const garmentsCsv = readCsvFile(options.garmentsPath);
  const garmentsFile = path.resolve(options.garmentsPath);
  const sourceFile = path.basename(garmentsFile);
  const rejectedRows: WatsonLegacyGarmentsRejectedRow[] = [];
  const garmentIdCounts = new Map<string, number>();
  const seenGarmentIds = new Set<string>();
  const garments: PreparedGarmentRow[] = [];
  let skippedDuplicates = 0;
  let blankGarmentIdCount = 0;
  let blankGarmentTitleCount = 0;

  for (const row of garmentsCsv.rejectedRows) {
    rejectedRows.push({
      lineNumber: row.lineNumber,
      reason: row.reason,
      raw: row.raw,
    });
  }

  garmentsCsv.rows.forEach((row, index) => {
    const lineNumber = index + 2;
    const garmentId = trimmed(row, "GarmentID");
    const garmentTitle = trimmed(row, "GarmentTitle");

    if (!garmentId) {
      blankGarmentIdCount += 1;
      rejectedRows.push({
        lineNumber,
        reason: "GarmentID is required",
        raw: JSON.stringify(row),
      });
      return;
    }

    garmentIdCounts.set(garmentId, (garmentIdCounts.get(garmentId) ?? 0) + 1);

    if (seenGarmentIds.has(garmentId)) {
      skippedDuplicates += 1;
      return;
    }

    if (!garmentTitle) {
      blankGarmentTitleCount += 1;
      rejectedRows.push({
        lineNumber,
        reason: `GarmentTitle is required for GarmentID ${garmentId}`,
        raw: JSON.stringify(row),
      });
      return;
    }

    seenGarmentIds.add(garmentId);
    garments.push({
      garment_id: garmentId,
      garment_title: garmentTitle,
      garment_description: cleanLegacyGarmentDescription(cell(row, "GarmentDescription")),
      source_file: sourceFile,
      lineNumber,
    });
  });

  const duplicateGarmentIds = [...garmentIdCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([garmentId, count]) => ({ garmentId, count }))
    .sort((a, b) => b.count - a.count || a.garmentId.localeCompare(b.garmentId));

  const descriptionCount = garments.filter((row) => row.garment_description).length;

  return {
    dryRun: {
      mode: "dry-run",
      garmentsFile,
      csvRowCount: garmentsCsv.rows.length,
      uniqueGarmentIdCount: garmentIdCounts.size,
      preparedRowCount: garments.length,
      duplicateGarmentIds,
      blankGarmentIdCount,
      blankGarmentTitleCount,
      descriptionCount,
      blankDescriptionCount: garments.length - descriptionCount,
      skippedDuplicateCount: skippedDuplicates,
      rejectedRowCount: rejectedRows.length,
      rejectedRows: rejectedRows.slice(0, 50),
      parseRejectedCount: garmentsCsv.rejectedRows.length,
    },
    garments,
    skippedDuplicates,
  };
}

export function dryRunWatsonLegacyGarments(options: {
  garmentsPath: string;
}): WatsonLegacyGarmentsDryRunReport {
  return prepareWatsonLegacyGarmentsImport(options).dryRun;
}

export function formatWatsonLegacyGarmentsDryRunReport(
  report: WatsonLegacyGarmentsDryRunReport,
): string {
  const lines = [
    "Watson cleaned legacy garments import — DRY RUN (no database writes)",
    `Garments file: ${report.garmentsFile}`,
    "",
    `CSV rows: ${report.csvRowCount}`,
    `Unique GarmentID count: ${report.uniqueGarmentIdCount}`,
    `Rows prepared for upsert: ${report.preparedRowCount}`,
    `Duplicate GarmentIDs: ${report.duplicateGarmentIds.length}`,
    `Blank GarmentID rows: ${report.blankGarmentIdCount}`,
    `Blank GarmentTitle rows: ${report.blankGarmentTitleCount}`,
    `Cleaned descriptions: ${report.descriptionCount}`,
    `Blank descriptions: ${report.blankDescriptionCount}`,
    `Skipped duplicate GarmentIDs: ${report.skippedDuplicateCount}`,
    `Rejected rows: ${report.rejectedRowCount}`,
    `CSV parse rejects: ${report.parseRejectedCount}`,
  ];

  if (report.duplicateGarmentIds.length > 0) {
    lines.push("", "Duplicate GarmentIDs:");
    for (const row of report.duplicateGarmentIds.slice(0, SAMPLE_LIMIT)) {
      lines.push(`  - ${row.garmentId} (${row.count})`);
    }
  }
  if (report.rejectedRows.length > 0) {
    lines.push("", "Rejected row sample:");
    for (const row of report.rejectedRows.slice(0, SAMPLE_LIMIT)) {
      lines.push(`  - line ${row.lineNumber}: ${row.reason}`);
    }
  }

  lines.push(
    "",
    "Apply identity key (locked): GarmentID (garment_id)",
    "Table: watson_legacy_garments",
    "Default mode is dry-run. Writes require an explicit --apply flag.",
    "This dry-run does not write to Postgres.",
  );
  return lines.join("\n");
}

function formatWriteCounts(label: string, counts: WatsonLegacyGarmentsWriteCounts): string[] {
  return [
    `${label}:`,
    `  CSV rows: ${counts.csvRowCount}`,
    `  Inserted: ${counts.inserted}`,
    `  Updated: ${counts.updated}`,
    `  Upserted: ${counts.upserted}`,
    `  Skipped: ${counts.skipped}`,
  ];
}

export function formatWatsonLegacyGarmentsApplyReport(
  report: WatsonLegacyGarmentsApplyReport,
): string {
  const lines = [
    `Watson cleaned legacy garments import — APPLY (${report.status})`,
    `Database target: ${report.databaseTarget}`,
    `Table: watson_legacy_garments`,
    `Batch: ${report.batchId}`,
    `Garments file: ${report.garmentsFile}`,
    `Apply identity key: GarmentID (garment_id)`,
    "",
    ...formatWriteCounts("Garments (watson_legacy_garments)", report.garments),
    "",
    "Does not truncate or write legacy_* dump tables.",
    "Does not modify Memberstack, Stripe, ActiveCampaign, or current membership data.",
  ];
  if (report.errorMessage) {
    lines.push("", report.errorMessage);
  }
  return lines.join("\n");
}

function applyAbortReason(report: WatsonLegacyGarmentsDryRunReport): string | null {
  if (report.rejectedRowCount > 0) {
    return `Aborted: ${report.rejectedRowCount} rejected row(s). Fix the CSV and dry-run again before --apply.`;
  }
  return null;
}

function buildUpsertSql(
  table: string,
  insertColumns: readonly string[],
  conflictColumn: string,
  updateColumns: readonly string[],
  rowCount: number,
): string {
  const insert = buildMultiRowInsertSql(table, [...insertColumns], rowCount);
  const assignments = updateColumns
    .map((column) => `${quoteIdent(column)} = EXCLUDED.${quoteIdent(column)}`)
    .join(", ");
  return `${insert} ON CONFLICT (${quoteIdent(conflictColumn)}) DO UPDATE SET ${assignments}, ${quoteIdent("imported_at")} = NOW() RETURNING (xmax = 0) AS inserted`;
}

function flattenRowParams(
  rows: Array<Record<string, unknown>>,
  columns: readonly string[],
): unknown[] {
  const params: unknown[] = [];
  for (const row of rows) {
    for (const column of columns) {
      params.push(row[column] ?? null);
    }
  }
  return params;
}

function countUpsertResult(rows: Array<Record<string, unknown>>): {
  inserted: number;
  updated: number;
} {
  let inserted = 0;
  let updated = 0;
  for (const row of rows) {
    if (row.inserted === true || row.inserted === "t") {
      inserted += 1;
    } else {
      updated += 1;
    }
  }
  return { inserted, updated };
}

async function upsertBatches(
  query: LegacyGarmentsQueryFn,
  rows: Array<Record<string, unknown>>,
  onProgress?: (message: string) => void,
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;
  for (let index = 0; index < rows.length; index += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(index, index + UPSERT_BATCH_SIZE);
    const sql = buildUpsertSql(
      GARMENTS_TABLE,
      GARMENT_INSERT_COLUMNS,
      "garment_id",
      GARMENT_UPDATE_COLUMNS,
      batch.length,
    );
    const result = await query(sql, flattenRowParams(batch, GARMENT_INSERT_COLUMNS));
    const counted = countUpsertResult(result.rows);
    inserted += counted.inserted;
    updated += counted.updated;
    onProgress?.(
      `${GARMENTS_TABLE}: upserted ${Math.min(index + batch.length, rows.length)} / ${rows.length}`,
    );
  }
  return { inserted, updated };
}

function defaultBatchId(garmentsPath: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `legacy-garments-${path.basename(garmentsPath, path.extname(garmentsPath))}-${stamp}`;
}

type PgPoolConfig = {
  connectionString: string;
  connectionTimeoutMillis: number;
};

type PgPool = {
  connect: () => Promise<PgClient & { release: () => void }>;
  end: () => Promise<void>;
};

type PgClient = {
  query: (sql: string, params?: unknown[]) => Promise<{
    rows: Array<Record<string, unknown>>;
    rowCount?: number | null;
  }>;
};

async function loadPg(): Promise<{ Pool: new (config: PgPoolConfig) => PgPool }> {
  const pg = await import("pg");
  return pg as { Pool: new (config: PgPoolConfig) => PgPool };
}

async function withLegacyGarmentsClient<T>(
  databaseUrl: string,
  queryFn: LegacyGarmentsQueryFn | undefined,
  fn: (query: LegacyGarmentsQueryFn) => Promise<T>,
): Promise<T> {
  if (queryFn) {
    return fn(queryFn);
  }

  const { Pool } = await loadPg();
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: WATSON_DB_CONNECTION_TIMEOUT_MS,
  });
  const client = await pool.connect();
  try {
    return await fn((sql, params) => client.query(sql, params));
  } finally {
    client.release();
    await pool.end();
  }
}

export async function applyWatsonLegacyGarments(options: {
  garmentsPath: string;
  databaseUrl: string;
  batchId?: string;
  queryFn?: LegacyGarmentsQueryFn;
  onProgress?: (message: string) => void;
}): Promise<WatsonLegacyGarmentsApplyReport> {
  const prepared = prepareWatsonLegacyGarmentsImport({
    garmentsPath: options.garmentsPath,
  });
  const batchId = options.batchId ?? defaultBatchId(options.garmentsPath);
  const databaseTarget = formatDatabaseTarget(options.databaseUrl);
  const abortReason = applyAbortReason(prepared.dryRun);

  const base = {
    mode: "apply" as const,
    databaseTarget,
    garmentsFile: prepared.dryRun.garmentsFile,
    batchId,
    dryRun: prepared.dryRun,
  };

  if (abortReason) {
    return {
      ...base,
      status: "aborted",
      garments: emptyWriteCounts(prepared.dryRun.csvRowCount, prepared.skippedDuplicates),
      errorMessage: abortReason,
    };
  }

  const garmentValues = prepared.garments.map((row) => ({
    ...row,
    batch_id: batchId,
  }));

  try {
    return await withLegacyGarmentsClient(options.databaseUrl, options.queryFn, async (query) => {
      await query("BEGIN");
      try {
        await applyWatsonLegacyGarmentsSchema(
          { query: (sql) => query(sql) },
          { onProgress: options.onProgress },
        );
        const writes = await upsertBatches(query, garmentValues, options.onProgress);
        await query("COMMIT");
        return {
          ...base,
          status: "completed" as const,
          garments: {
            csvRowCount: prepared.dryRun.csvRowCount,
            inserted: writes.inserted,
            updated: writes.updated,
            upserted: writes.inserted + writes.updated,
            skipped: prepared.skippedDuplicates,
          },
        };
      } catch (error) {
        await query("ROLLBACK");
        throw error;
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      ...base,
      status: "failed",
      garments: emptyWriteCounts(prepared.dryRun.csvRowCount, prepared.skippedDuplicates),
      errorMessage: `Failed: ${errorMessage}`,
    };
  }
}
