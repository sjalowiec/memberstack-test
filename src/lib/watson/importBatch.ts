import { coerceCellValue } from "./coerceValue";
import { resolveSourceHeader } from "./columnNormalize";
import { readCsvFile } from "./csvReader";
import path from "path";
import {
  ensureRejectDir,
  writeParseRejectedRows,
  writeRejectedRows,
  type RejectedImportRow,
} from "./rejectWriter";
import { applyLegacySchema, applyLegacyIndexes, quoteIdent, truncateLegacyTables, configureImportSession, findBlockingImportSessions, formatBlockingImportSessionsMessage } from "./schema";
import { getLegacyTableDefByPgTable, LEGACY_TABLE_DEFINITIONS, LEGACY_TABLE_LOAD_ORDER } from "./tableDefinitions";
import {
  inferBatchIdFromExportDir,
  resolveExportFiles,
  type ResolvedExportFile,
} from "./resolveExportFiles";
import { WATSON_DB_CONNECTION_TIMEOUT_MS } from "./env";
import type { ImportBatchReport, TableImportReport } from "./types";

const INSERT_BATCH_SIZE = 500;
const ROW_PROGRESS_INTERVAL = 1_000;

export interface ImportBatchOptions {
  exportDir: string;
  batchId?: string;
  dryRun?: boolean;
  schemaOnly?: boolean;
  rejectRootDir?: string;
  onProgress?: (message: string) => void;
}

type PgClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }>;
};

type PgPool = {
  connect: () => Promise<PgClient & { release: () => void }>;
  end: () => Promise<void>;
};

type PgPoolConfig = {
  connectionString: string;
  connectionTimeoutMillis: number;
};

async function loadPg(): Promise<{ Pool: new (config: PgPoolConfig) => PgPool }> {
  try {
    const pg = await import("pg");
    return pg as { Pool: new (config: PgPoolConfig) => PgPool };
  } catch {
    throw new Error(
      "The pg package is not installed. Run: npm install --save-dev pg @types/pg",
    );
  }
}

function logProgress(options: ImportBatchOptions, message: string): void {
  options.onProgress?.(message);
}

function buildInsertSql(pgTable: string, pgColumns: string[]): string {
  const cols = pgColumns.map(quoteIdent).join(", ");
  const placeholders = pgColumns.map((_, index) => `$${index + 1}`).join(", ");
  return `INSERT INTO ${quoteIdent(pgTable)} (${cols}) VALUES (${placeholders})`;
}

export function buildMultiRowInsertSql(
  pgTable: string,
  pgColumns: string[],
  rowCount: number,
): string {
  if (rowCount < 1) {
    throw new Error("rowCount must be at least 1");
  }

  const cols = pgColumns.map(quoteIdent).join(", ");
  let paramIndex = 1;
  const valueGroups: string[] = [];

  for (let row = 0; row < rowCount; row++) {
    const placeholders = pgColumns.map(() => `$${paramIndex++}`).join(", ");
    valueGroups.push(`(${placeholders})`);
  }

  return `INSERT INTO ${quoteIdent(pgTable)} (${cols}) VALUES ${valueGroups.join(", ")}`;
}

function flattenRowParams(rows: Record<string, unknown>[], pgColumns: string[]): unknown[] {
  const params: unknown[] = [];
  for (const row of rows) {
    for (const column of pgColumns) {
      params.push(row[column] ?? null);
    }
  }
  return params;
}

function logRowProgress(
  pgTable: string,
  processed: number,
  total: number,
  lastLogged: number,
  onProgress?: (message: string) => void,
): number {
  let nextLogged = lastLogged;
  while (nextLogged + ROW_PROGRESS_INTERVAL <= processed) {
    nextLogged += ROW_PROGRESS_INTERVAL;
    onProgress?.(`Import progress: ${pgTable} ${nextLogged}/${total} rows inserted`);
  }
  if (processed === total && processed > nextLogged) {
    onProgress?.(`Import progress: ${pgTable} ${processed}/${total} rows inserted`);
    return processed;
  }
  return nextLogged;
}

async function insertRows(
  client: PgClient,
  pgTable: string,
  pgColumns: string[],
  rows: Record<string, unknown>[],
  rejected: RejectedImportRow[],
  onProgress?: (message: string) => void,
): Promise<{ inserted: number; failed: number }> {
  const singleInsertSql = buildInsertSql(pgTable, pgColumns);
  let inserted = 0;
  let failed = 0;
  let lastLogged = 0;
  const total = rows.length;

  for (let offset = 0; offset < rows.length; offset += INSERT_BATCH_SIZE) {
    const batch = rows.slice(offset, offset + INSERT_BATCH_SIZE);

    try {
      const batchSql = buildMultiRowInsertSql(pgTable, pgColumns, batch.length);
      await client.query(batchSql, flattenRowParams(batch, pgColumns));
      inserted += batch.length;
      lastLogged = logRowProgress(pgTable, inserted, total, lastLogged, onProgress);
    } catch {
      for (let index = 0; index < batch.length; index++) {
        const row = batch[index];
        try {
          await client.query(
            singleInsertSql,
            pgColumns.map((column) => row[column] ?? null),
          );
          inserted++;
          lastLogged = logRowProgress(pgTable, inserted, total, lastLogged, onProgress);
        } catch (error) {
          failed++;
          rejected.push({
            lineNumber: offset + index + 2,
            reason: error instanceof Error ? error.message : String(error),
            raw: JSON.stringify(row),
          });
        }
      }
    }
  }

  return { inserted, failed };
}

function dedupeRows(
  rows: Record<string, unknown>[],
  primaryKey: string[],
): { uniqueRows: Record<string, unknown>[]; skipped: number } {
  const seen = new Set<string>();
  const uniqueRows: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const row of rows) {
    const key = primaryKey.map((column) => String(row[column] ?? "")).join("\u0000");
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    uniqueRows.push(row);
  }

  return { uniqueRows, skipped };
}

async function importTable(
  client: PgClient,
  pgTable: string,
  csvPath: string,
  rejectDir: string,
  onProgress?: (message: string) => void,
): Promise<TableImportReport> {
  const def = getLegacyTableDefByPgTable(pgTable);
  if (!def) {
    throw new Error(`Unknown legacy table: ${pgTable}`);
  }

  const parsed = readCsvFile(csvPath);
  onProgress?.(`Parsed ${parsed.rows.length} CSV rows for ${pgTable}.`);
  const headerIndex = new Map<string, string>();
  for (const header of parsed.headers) {
    headerIndex.set(header.toLowerCase(), header);
  }

  const rejected: RejectedImportRow[] = [];
  const coercedRows: Record<string, unknown>[] = [];

  for (let index = 0; index < parsed.rows.length; index++) {
    const sourceRow = parsed.rows[index];
    const coerced: Record<string, unknown> = {};
    let rowFailed = false;

    for (const column of def.columns) {
      const sourceHeader = resolveSourceHeader(headerIndex, column.source);
      if (!sourceHeader) {
        rejected.push({
          lineNumber: index + 2,
          reason: `Missing expected CSV column: ${column.source}`,
          raw: JSON.stringify(sourceRow),
          row: sourceRow,
        });
        rowFailed = true;
        break;
      }

      const result = coerceCellValue(sourceRow[sourceHeader], column);
      if (!result.ok) {
        rejected.push({
          lineNumber: index + 2,
          reason: result.reason,
          raw: JSON.stringify(sourceRow),
          row: sourceRow,
        });
        rowFailed = true;
        break;
      }
      coerced[column.pg] = result.value;
    }

    if (!rowFailed) {
      coercedRows.push(coerced);
    }

    if ((index + 1) % ROW_PROGRESS_INTERVAL === 0) {
      onProgress?.(`Coercion progress: ${pgTable} ${index + 1}/${parsed.rows.length} rows`);
    }
  }

  onProgress?.(`Coerced ${coercedRows.length} rows for ${pgTable}; deduplicating...`);

  const parseRejectFile = writeParseRejectedRows(rejectDir, pgTable, parsed.rejectedRows);
  const rejectFile =
    writeRejectedRows(rejectDir, pgTable, parsed.headers, rejected) ?? parseRejectFile;

  const { uniqueRows, skipped } = dedupeRows(coercedRows, def.primaryKey);
  const pgColumns = def.columns.map((column) => column.pg);

  onProgress?.(`Inserting ${uniqueRows.length} rows into ${pgTable} (${INSERT_BATCH_SIZE} rows per batch)...`);
  const { inserted, failed } = await insertRows(
    client,
    pgTable,
    pgColumns,
    uniqueRows,
    rejected,
    onProgress,
  );

  if (failed > 0) {
    writeRejectedRows(rejectDir, pgTable, parsed.headers, rejected);
  }

  return {
    exportName: def.exportName,
    pgTable,
    csvPath,
    fileName: path.basename(csvPath),
    selectionReason: "",
    alternateMatches: [],
    csvRowCount: parsed.rows.length,
    inserted,
    skipped,
    rejected: rejected.length,
    failed,
    rejectFile,
  };
}

function withResolvedFileMetadata(
  report: TableImportReport,
  resolved: ResolvedExportFile,
): TableImportReport {
  return {
    ...report,
    csvPath: resolved.filePath,
    fileName: resolved.fileName,
    selectionReason: resolved.selectionReason,
    alternateMatches: resolved.alternateMatches,
  };
}

export async function importLegacyBatch(
  databaseUrl: string,
  options: ImportBatchOptions,
): Promise<ImportBatchReport> {
  const batchId = options.batchId ?? inferBatchIdFromExportDir(options.exportDir);
  const dryRun = options.dryRun ?? false;
  const startedAt = new Date().toISOString();
  const rejectRootDir = options.rejectRootDir ?? "legacy-data/import-errors";

  const { resolved, missingRequired } = resolveExportFiles(
    options.exportDir,
    LEGACY_TABLE_DEFINITIONS,
  );

  if (missingRequired.length > 0 && !dryRun) {
    return {
      batchId,
      dryRun,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "failed",
      errorMessage: `Missing required CSV exports: ${missingRequired.join(", ")}`,
      tables: [],
      missingRequired,
    };
  }

  const rejectDir = ensureRejectDir(batchId, rejectRootDir);
  const tableReports: TableImportReport[] = [];

  if (dryRun) {
    for (const pgTable of LEGACY_TABLE_LOAD_ORDER) {
      const match = resolved.find((entry) => entry.pgTable === pgTable);
      if (!match) {
        continue;
      }
      const parsed = readCsvFile(match.filePath);
      tableReports.push({
        exportName: match.exportName,
        pgTable,
        csvPath: match.filePath,
        fileName: match.fileName,
        selectionReason: match.selectionReason,
        alternateMatches: match.alternateMatches,
        csvRowCount: parsed.rows.length,
        inserted: 0,
        skipped: 0,
        rejected: parsed.rejectedRows.length,
        failed: 0,
        rejectFile: writeParseRejectedRows(rejectDir, pgTable, parsed.rejectedRows),
      });
    }

    return {
      batchId,
      dryRun: true,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "dry-run",
      errorMessage:
        missingRequired.length > 0
          ? `Missing required CSV exports: ${missingRequired.join(", ")}`
          : undefined,
      tables: tableReports,
      missingRequired,
    };
  }

  const rejectDirForImport = rejectDir;

  logProgress(options, "Loading Postgres driver...");
  const { Pool } = await loadPg();
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: WATSON_DB_CONNECTION_TIMEOUT_MS,
  });

  let client: (PgClient & { release: () => void }) | undefined;
  let transactionStarted = false;

  try {
    logProgress(
      options,
      `Attempting database connection (timeout ${WATSON_DB_CONNECTION_TIMEOUT_MS / 1000}s)...`,
    );
    client = await pool.connect();
    logProgress(options, "Database connection successful.");

    logProgress(options, "Configuring import session (statement timeout)...");
    await configureImportSession(client);
    logProgress(options, "Import session configured.");

    const blockingSessions = await findBlockingImportSessions(client);
    if (blockingSessions.length > 0) {
      throw new Error(formatBlockingImportSessionsMessage(blockingSessions));
    }

    logProgress(options, "Schema creation started...");
    await applyLegacySchema(client, { onProgress: options.onProgress });
    logProgress(options, "Schema creation completed.");

    if (options.schemaOnly) {
      await applyLegacyIndexes(client, { onProgress: options.onProgress });
      logProgress(options, "Schema-only run completed.");

      return {
        batchId,
        dryRun: false,
        startedAt,
        completedAt: new Date().toISOString(),
        status: "completed",
        tables: [],
        missingRequired: [],
      };
    }

    await client.query("BEGIN");
    transactionStarted = true;

    const importRun = await client.query(
      `INSERT INTO watson_import_runs (batch_id, status) VALUES ($1, 'running') RETURNING id`,
      [batchId],
    );
    const importRunId = Number(importRun.rows[0]?.id);

    await truncateLegacyTables(
      client,
      LEGACY_TABLE_DEFINITIONS.map((def) => def.pgTable),
    );

    for (const pgTable of LEGACY_TABLE_LOAD_ORDER) {
      const match = resolved.find((entry) => entry.pgTable === pgTable);
      if (!match) {
        continue;
      }

      logProgress(options, `Import started: ${pgTable} (${match.fileName})`);
      const report = withResolvedFileMetadata(
        await importTable(client, pgTable, match.filePath, rejectDirForImport, options.onProgress),
        match,
      );
      tableReports.push(report);
      logProgress(
        options,
        `Import completed: ${pgTable} (inserted=${report.inserted}, rejected=${report.rejected}, failed=${report.failed})`,
      );

      await client.query(
        `INSERT INTO watson_import_run_tables (
          import_run_id, pg_table, export_name, csv_path, csv_row_count,
          inserted_count, skipped_count, rejected_count, failed_count, reject_file
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          importRunId,
          report.pgTable,
          report.exportName,
          report.csvPath,
          report.csvRowCount,
          report.inserted,
          report.skipped,
          report.rejected,
          report.failed,
          report.rejectFile ?? null,
        ],
      );

      if (report.failed > 0) {
        throw new Error(
          `Import failed for ${report.pgTable}: ${report.failed} row(s) failed to insert`,
        );
      }
    }

    await client.query(
      `UPDATE watson_import_runs SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [importRunId],
    );

    await applyLegacyIndexes(client, { onProgress: options.onProgress });

    await client.query("COMMIT");
    transactionStarted = false;
    logProgress(options, "Transaction committed.");

    return {
      batchId,
      dryRun: false,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "completed",
      importRunId,
      tables: tableReports,
      missingRequired: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (client && transactionStarted) {
      logProgress(options, "Rolling back transaction...");
      try {
        await client.query("ROLLBACK");
        logProgress(options, "Transaction rolled back.");
      } catch (rollbackError) {
        logProgress(
          options,
          `Transaction rollback failed: ${
            rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
          }`,
        );
      }

      try {
        await client.query(
          `INSERT INTO watson_import_runs (batch_id, status, error_message, completed_at)
           VALUES ($1, 'failed', $2, NOW())`,
          [batchId, message],
        );
      } catch {
        // ignore secondary logging failure
      }
    }

    if (!client) {
      throw new Error(`Database connection failed: ${message}`);
    }

    return {
      batchId,
      dryRun: false,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "failed",
      errorMessage: message,
      tables: tableReports,
      missingRequired: [],
    };
  } finally {
    client?.release();
    await pool.end();
  }
}

export function formatImportReport(report: ImportBatchReport): string {
  const lines = [
    `Watson legacy import  batch ${report.batchId}`,
    `Status: ${report.status}`,
    `Started: ${report.startedAt}`,
  ];

  if (report.completedAt) {
    lines.push(`Completed: ${report.completedAt}`);
  }
  if (report.errorMessage) {
    lines.push(`Error: ${report.errorMessage}`);
  }
  if (report.missingRequired.length > 0) {
    lines.push(`Missing required exports: ${report.missingRequired.join(", ")}`);
  }

  lines.push("");
  lines.push("Table results:");
  for (const table of report.tables) {
    lines.push(
      `- ${table.exportName} (${table.pgTable}): file=${table.fileName}, csv=${table.csvRowCount}, inserted=${table.inserted}, skipped=${table.skipped}, rejected=${table.rejected}, failed=${table.failed}`,
    );
    if (table.selectionReason) {
      lines.push(`  selected: ${table.selectionReason}`);
    }
    if (table.alternateMatches.length > 0) {
      lines.push(`  skipped matches: ${table.alternateMatches.join(", ")}`);
    }
    if (table.rejectFile) {
      lines.push(`  reject file: ${table.rejectFile}`);
    }
  }

  return lines.join("\n");
}
