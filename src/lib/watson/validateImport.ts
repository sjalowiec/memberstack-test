import { readCsvFile } from "./csvReader";
import { getWatsonDatabaseUrl } from "./env";
import {
  inferBatchIdFromExportDir,
  resolveExportFiles,
} from "./resolveExportFiles";
import { quoteIdent } from "./schema";
import { LEGACY_TABLE_DEFINITIONS, LEGACY_TABLE_LOAD_ORDER } from "./tableDefinitions";
import type { ValidateImportReport } from "./types";

type PgPool = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  end: () => Promise<void>;
};

async function loadPgPool(databaseUrl: string): Promise<PgPool> {
  try {
    const pg = await import("pg");
    const pool = new pg.Pool({ connectionString: databaseUrl });
    return pool;
  } catch {
    throw new Error(
      "The pg package is not installed. Run: npm install --save-dev pg @types/pg",
    );
  }
}

export interface ValidateImportOptions {
  exportDir: string;
  batchId?: string;
  databaseUrl?: string;
}

export async function validateLegacyImport(
  options: ValidateImportOptions,
): Promise<ValidateImportReport> {
  const batchId = options.batchId ?? inferBatchIdFromExportDir(options.exportDir);
  const { resolved, missingRequired } = resolveExportFiles(
    options.exportDir,
    LEGACY_TABLE_DEFINITIONS,
  );

  if (missingRequired.length > 0) {
    return {
      batchId,
      ok: false,
      missingRequired,
      tables: [],
      message: `Missing required CSV exports: ${missingRequired.join(", ")}`,
    };
  }

  const csvCounts = new Map<string, number>();
  for (const entry of resolved) {
    csvCounts.set(entry.pgTable, readCsvFile(entry.filePath).rows.length);
  }

  const databaseUrl = options.databaseUrl ?? getWatsonDatabaseUrl();
  const pool = await loadPgPool(databaseUrl);

  try {
    const lastRun = await pool.query(
      `SELECT id FROM watson_import_runs
       WHERE status = 'completed'
       ORDER BY id DESC
       LIMIT 1`,
    );
    const lastRunId = lastRun.rows[0]?.id ? Number(lastRun.rows[0].id) : null;

    const tables = [];
    let ok = true;

    for (const pgTable of LEGACY_TABLE_LOAD_ORDER) {
      const csvRowCount = csvCounts.get(pgTable) ?? 0;
      let postgresRowCount: number | null = null;
      let insertedCount: number | null = null;
      let match = false;

      try {
        const result = await pool.query(
          `SELECT COUNT(*)::int AS count FROM ${quoteIdent(pgTable)}`,
        );
        postgresRowCount = Number(result.rows[0]?.count ?? 0);

        if (lastRunId != null) {
          const imported = await pool.query(
            `SELECT inserted_count::int AS inserted_count
             FROM watson_import_run_tables
             WHERE import_run_id = $1 AND pg_table = $2`,
            [lastRunId, pgTable],
          );
          insertedCount =
            imported.rows[0]?.inserted_count != null
              ? Number(imported.rows[0].inserted_count)
              : null;
        }

        if (insertedCount != null) {
          match = postgresRowCount === insertedCount;
        } else {
          match = postgresRowCount === csvRowCount;
        }

        if (!match) {
          ok = false;
        }
      } catch (error) {
        ok = false;
        postgresRowCount = null;
        return {
          batchId,
          ok: false,
          missingRequired: [],
          tables: [
            {
              pgTable,
              csvRowCount,
              postgresRowCount,
              match: false,
            },
          ],
          message:
            error instanceof Error
              ? error.message
              : "Failed to query Postgres table counts",
        };
      }

      tables.push({
        pgTable,
        csvRowCount,
        postgresRowCount,
        insertedCount,
        match,
      });
    }

    return {
      batchId,
      ok,
      missingRequired: [],
      tables,
      message: ok
        ? "Postgres row counts match CSV row counts."
        : "Postgres row counts do not match CSV row counts.",
    };
  } finally {
    await pool.end();
  }
}

export function formatValidateReport(report: ValidateImportReport): string {
  const lines = [
    `Watson import validation - batch ${report.batchId}`,
    `OK: ${report.ok ? "yes" : "no"}`,
  ];

  if (report.message) {
    lines.push(report.message);
  }
  if (report.missingRequired.length > 0) {
    lines.push(`Missing required exports: ${report.missingRequired.join(", ")}`);
  }

  lines.push("");
  for (const table of report.tables) {
    const inserted =
      table.insertedCount != null ? `, inserted=${table.insertedCount}` : "";
    lines.push(
      `- ${table.pgTable}: csv=${table.csvRowCount}, postgres=${table.postgresRowCount ?? "n/a"}${inserted}, match=${table.match ? "yes" : "no"}`,
    );
  }

  return lines.join("\n");
}
