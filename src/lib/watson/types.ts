export type PgColumnType = "text" | "bigint" | "integer" | "numeric" | "timestamptz" | "date";

export interface ColumnDef {
  /** CSV header name (matched case-insensitively). */
  source: string;
  /** Postgres column name (lowercase). */
  pg: string;
  type: PgColumnType;
  nullable?: boolean;
}

export interface LegacyTableDef {
  /** Approved legacy export name. */
  exportName: string;
  pgTable: string;
  primaryKey: string[];
  columns: ColumnDef[];
  /** When true, importer fails if this CSV is missing. */
  required: boolean;
}

export interface ParsedCsv {
  filePath: string;
  encoding: string;
  headers: string[];
  rows: Record<string, string>[];
}

export interface RowImportResult {
  inserted: number;
  skipped: number;
  rejected: number;
  failed: number;
}

export interface TableImportReport extends RowImportResult {
  exportName: string;
  pgTable: string;
  csvPath: string;
  fileName: string;
  selectionReason: string;
  alternateMatches: string[];
  csvRowCount: number;
  rejectFile?: string;
}

export interface ImportBatchReport {
  batchId: string;
  dryRun: boolean;
  startedAt: string;
  completedAt?: string;
  status: "completed" | "failed" | "dry-run";
  errorMessage?: string;
  importRunId?: number;
  tables: TableImportReport[];
  missingRequired: string[];
}

export interface ValidateImportReport {
  batchId: string;
  ok: boolean;
  tables: Array<{
    pgTable: string;
    csvRowCount: number;
    postgresRowCount: number | null;
    insertedCount?: number | null;
    match: boolean;
  }>;
  missingRequired: string[];
  message?: string;
}
