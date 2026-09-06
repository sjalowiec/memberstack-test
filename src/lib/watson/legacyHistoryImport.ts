/**
 * Cleaned legacy customers/history importer.
 * Default mode is dry-run (no Postgres writes). Writes require explicit --apply.
 * Never truncates or writes legacy_* dump tables.
 */
import path from "node:path";

import { readCsvFile } from "./csvReader";
import { isNullLiteral } from "./coerceValue";
import { formatDatabaseTarget, WATSON_DB_CONNECTION_TIMEOUT_MS } from "./env";
import { buildMultiRowInsertSql } from "./importBatch";
import { applyWatsonLegacyHistorySchema, quoteIdent } from "./schema";
import {
  HISTORY_IDENTITY_CANDIDATES,
  HISTORY_IDENTITY_FALLBACK,
  HISTORY_IDENTITY_APPLY,
  isWatsonLegacyHistoryCategory,
  type HistoryIdentityCandidateReport,
  type WatsonLegacyHistoryApplyReport,
  type WatsonLegacyHistoryCategory,
  type WatsonLegacyHistoryDryRunReport,
  type WatsonLegacyRejectedRow,
  type WatsonLegacyTableWriteCounts,
} from "./legacyHistoryTypes";

const IDENTITY_SEPARATOR = "\u001f";
const SAMPLE_LIMIT = 12;
const UPSERT_BATCH_SIZE = 500;

const CUSTOMER_INSERT_COLUMNS = [
  "legacy_memberid",
  "first_name",
  "last_name",
  "email",
  "date_joined",
  "customer_notes",
  "source_file",
  "batch_id",
] as const;

const CUSTOMER_UPDATE_COLUMNS = CUSTOMER_INSERT_COLUMNS.filter(
  (column) => column !== "legacy_memberid",
);

const HISTORY_INSERT_COLUMNS = [
  "identity_key",
  "legacy_memberid",
  "category",
  "transaction_date",
  "description",
  "amount",
  "expiration_date",
  "processor",
  "source_record_id",
  "item_id",
  "transaction_id",
  "source_file",
  "batch_id",
] as const;

const HISTORY_UPDATE_COLUMNS = HISTORY_INSERT_COLUMNS.filter(
  (column) => column !== "identity_key",
);

export type LegacyHistoryQueryFn = (
  sql: string,
  params?: unknown[],
) => Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }>;

type PreparedCustomerRow = {
  legacy_memberid: string;
  first_name: string;
  last_name: string;
  email: string;
  date_joined: string | null;
  customer_notes: string;
  source_file: string;
  lineNumber: number;
};

type PreparedHistoryRow = {
  identity_key: string;
  legacy_memberid: string;
  category: WatsonLegacyHistoryCategory;
  transaction_date: string | null;
  description: string;
  amount: number | null;
  expiration_date: string | null;
  processor: string;
  source_record_id: string;
  item_id: string;
  transaction_id: string;
  source_file: string;
  lineNumber: number;
};

type PreparedLegacyHistoryImport = {
  dryRun: WatsonLegacyHistoryDryRunReport;
  customers: PreparedCustomerRow[];
  history: PreparedHistoryRow[];
  skippedCustomers: number;
  skippedHistory: number;
};

function emptyWriteCounts(csvRowCount: number, skipped = 0): WatsonLegacyTableWriteCounts {
  return {
    csvRowCount,
    upserted: 0,
    inserted: 0,
    updated: 0,
    skipped,
  };
}

export function cell(row: Record<string, string>, header: string): string {
  const direct = row[header];
  if (direct != null) return direct;
  const match = Object.keys(row).find((key) => key.toLowerCase() === header.toLowerCase());
  return match ? row[match] : "";
}

export function trimmed(row: Record<string, string>, header: string): string {
  return cell(row, header).trim();
}

export function parseOptionalDate(
  raw: string,
  label: string,
): { ok: true; value: string | null } | { ok: false; reason: string } {
  if (isNullLiteral(raw)) return { ok: true, value: null };
  const value = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) {
    return { ok: true, value: `${iso[1]}-${iso[2]}-${iso[3]}` };
  }
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\b|$)/.exec(value);
  if (us) {
    const month = Number(us[1]);
    const day = Number(us[2]);
    const year = Number(us[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return { ok: false, reason: `${label} is not a valid date: ${raw}` };
    }
    return {
      ok: true,
      value: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    };
  }
  return { ok: false, reason: `${label} is not a valid date: ${raw}` };
}

export function parseOptionalAmount(
  raw: string,
): { ok: true; value: number | null } | { ok: false; reason: string } {
  if (isNullLiteral(raw)) return { ok: true, value: null };
  const normalized = raw.trim().replace(/[$,]/g, "");
  if (!normalized) return { ok: true, value: null };
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return { ok: false, reason: `Amount is not a valid number: ${raw}` };
  }
  return { ok: true, value: parsed };
}

export function identityKeyForRow(
  row: Record<string, string>,
  fields: readonly string[],
): string {
  return fields.map((field) => trimmed(row, field)).join(IDENTITY_SEPARATOR);
}

export function inspectHistoryIdentity(
  rows: Record<string, string>[],
): HistoryIdentityCandidateReport[] {
  return HISTORY_IDENTITY_CANDIDATES.map((candidate) => {
    const counts = new Map<string, number>();
    let blankKeyCount = 0;
    for (const row of rows) {
      const key = identityKeyForRow(row, candidate.fields);
      if (!key.replaceAll(IDENTITY_SEPARATOR, "").trim()) {
        blankKeyCount += 1;
      }
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const duplicates = [...counts.entries()].filter(([, count]) => count > 1);
    return {
      name: candidate.name,
      fields: [...candidate.fields],
      unique: duplicates.length === 0 && rows.length > 0,
      duplicateCount: duplicates.reduce((sum, [, count]) => sum + count, 0),
      blankKeyCount,
      sampleDuplicates: duplicates.slice(0, SAMPLE_LIMIT).map(([key, count]) => {
        const display = key.replaceAll(IDENTITY_SEPARATOR, " | ") || "(blank)";
        return `${display} (${count})`;
      }),
    };
  });
}

export function chooseHistoryIdentityKey(
  candidates: HistoryIdentityCandidateReport[],
): HistoryIdentityCandidateReport {
  const unique = candidates.find((candidate) => candidate.unique);
  if (unique) return unique;
  return (
    candidates.find((candidate) => candidate.name === HISTORY_IDENTITY_FALLBACK.name) ??
    candidates[candidates.length - 1]
  );
}

function countBy(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    const key = value || "(blank)";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function duplicatesFromCounts(
  counts: Map<string, { count: number; extras?: string[] }>,
): Array<{ key: string; count: number; extras: string[] }> {
  return [...counts.entries()]
    .filter(([, info]) => info.count > 1)
    .map(([key, info]) => ({ key, count: info.count, extras: info.extras ?? [] }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function applyAbortReason(report: WatsonLegacyHistoryDryRunReport): string | null {
  if (report.rejectedRowCount > 0) {
    return `Aborted: ${report.rejectedRowCount} rejected row(s). Fix the CSVs and dry-run again before --apply.`;
  }
  if (report.duplicateCustomerLegacyMemberIds.length > 0) {
    return `Aborted: ${report.duplicateCustomerLegacyMemberIds.length} duplicate LegacyMemberID(s) in the customer file.`;
  }
  const applyIdentity = report.identityCandidates.find(
    (candidate) => candidate.name === HISTORY_IDENTITY_APPLY.name,
  );
  if (!applyIdentity?.unique) {
    return `Aborted: apply identity ${HISTORY_IDENTITY_APPLY.name} is not unique.`;
  }
  return null;
}

export function prepareWatsonLegacyHistoryImport(options: {
  customersPath: string;
  historyPath: string;
}): PreparedLegacyHistoryImport {
  const customersCsv = readCsvFile(options.customersPath);
  const historyCsv = readCsvFile(options.historyPath);
  const rejectedRows: WatsonLegacyRejectedRow[] = [];
  const customersFile = path.resolve(options.customersPath);
  const historyFile = path.resolve(options.historyPath);
  const customerSourceFile = path.basename(customersFile);
  const historySourceFile = path.basename(historyFile);

  for (const row of customersCsv.rejectedRows) {
    rejectedRows.push({
      file: "customers",
      lineNumber: row.lineNumber,
      reason: row.reason,
      raw: row.raw,
    });
  }
  for (const row of historyCsv.rejectedRows) {
    rejectedRows.push({
      file: "history",
      lineNumber: row.lineNumber,
      reason: row.reason,
      raw: row.raw,
    });
  }

  const customerIds = new Map<string, number>();
  const emails = new Map<string, { count: number; extras: string[] }>();
  const seenCustomerIds = new Set<string>();
  const customers: PreparedCustomerRow[] = [];
  let skippedCustomers = 0;
  let blankCustomerEmailCount = 0;
  let malformedDateCount = 0;
  let malformedAmountCount = 0;

  customersCsv.rows.forEach((row, index) => {
    const lineNumber = index + 2;
    const legacyMemberId = trimmed(row, "LegacyMemberID");
    if (!legacyMemberId) {
      rejectedRows.push({
        file: "customers",
        lineNumber,
        reason: "LegacyMemberID is required",
        raw: JSON.stringify(row),
      });
      return;
    }
    customerIds.set(legacyMemberId, (customerIds.get(legacyMemberId) ?? 0) + 1);

    const joined = parseOptionalDate(cell(row, "DateJoined"), "DateJoined");
    if (!joined.ok) {
      malformedDateCount += 1;
      rejectedRows.push({
        file: "customers",
        lineNumber,
        reason: joined.reason,
        raw: JSON.stringify(row),
      });
    } else if (seenCustomerIds.has(legacyMemberId)) {
      skippedCustomers += 1;
    } else {
      seenCustomerIds.add(legacyMemberId);
      customers.push({
        legacy_memberid: legacyMemberId,
        first_name: cell(row, "FirstName"),
        last_name: cell(row, "Lastname"),
        email: cell(row, "Email"),
        date_joined: joined.value,
        customer_notes: cell(row, "CustomerNotes"),
        source_file: customerSourceFile,
        lineNumber,
      });
    }

    const email = trimmed(row, "Email").toLowerCase();
    if (!email) {
      blankCustomerEmailCount += 1;
      return;
    }
    const existing = emails.get(email) ?? { count: 0, extras: [] };
    existing.count += 1;
    if (!existing.extras.includes(legacyMemberId)) existing.extras.push(legacyMemberId);
    emails.set(email, existing);
  });

  const validCustomerIds = new Set(
    [...customerIds.entries()].filter(([, count]) => count >= 1).map(([id]) => id),
  );

  const identityCandidates = inspectHistoryIdentity(historyCsv.rows);
  const chosenIdentity = chooseHistoryIdentityKey(identityCandidates);
  const identityCounts = new Map<string, number>();
  const categoryValues: string[] = [];
  const invalidCategoryCounts = new Map<string, number>();
  const orphans: Array<{ lineNumber: number; legacyMemberId: string }> = [];
  const seenHistoryKeys = new Set<string>();
  const history: PreparedHistoryRow[] = [];
  let skippedHistory = 0;

  historyCsv.rows.forEach((row, index) => {
    const lineNumber = index + 2;
    const legacyMemberId = trimmed(row, "LegacyMemberID");
    const category = trimmed(row, "Category");
    categoryValues.push(category);
    let rowOk = true;

    if (!legacyMemberId) {
      rowOk = false;
      rejectedRows.push({
        file: "history",
        lineNumber,
        reason: "LegacyMemberID is required",
        raw: JSON.stringify(row),
      });
    } else if (!validCustomerIds.has(legacyMemberId)) {
      rowOk = false;
      orphans.push({ lineNumber, legacyMemberId });
      rejectedRows.push({
        file: "history",
        lineNumber,
        reason: `Orphan history row: LegacyMemberID ${legacyMemberId} is not in the customer file`,
        raw: JSON.stringify(row),
      });
    }

    if (!isWatsonLegacyHistoryCategory(category)) {
      rowOk = false;
      invalidCategoryCounts.set(category || "(blank)", (invalidCategoryCounts.get(category || "(blank)") ?? 0) + 1);
      rejectedRows.push({
        file: "history",
        lineNumber,
        reason: `Invalid category: ${category || "(blank)"}`,
        raw: JSON.stringify(row),
      });
    }

    const transactionDate = parseOptionalDate(cell(row, "TransactionDate"), "TransactionDate");
    if (!transactionDate.ok) {
      rowOk = false;
      malformedDateCount += 1;
      rejectedRows.push({
        file: "history",
        lineNumber,
        reason: transactionDate.reason,
        raw: JSON.stringify(row),
      });
    }

    const expirationDate = parseOptionalDate(cell(row, "ExpirationDate"), "ExpirationDate");
    if (!expirationDate.ok) {
      rowOk = false;
      malformedDateCount += 1;
      rejectedRows.push({
        file: "history",
        lineNumber,
        reason: expirationDate.reason,
        raw: JSON.stringify(row),
      });
    }

    const amount = parseOptionalAmount(cell(row, "Amount"));
    if (!amount.ok) {
      rowOk = false;
      malformedAmountCount += 1;
      rejectedRows.push({
        file: "history",
        lineNumber,
        reason: amount.reason,
        raw: JSON.stringify(row),
      });
    }

    const key = identityKeyForRow(row, chosenIdentity.fields);
    identityCounts.set(key, (identityCounts.get(key) ?? 0) + 1);

    if (
      rowOk &&
      legacyMemberId &&
      isWatsonLegacyHistoryCategory(category) &&
      transactionDate.ok &&
      expirationDate.ok &&
      amount.ok
    ) {
      const applyKey = identityKeyForRow(row, HISTORY_IDENTITY_APPLY.fields);
      if (seenHistoryKeys.has(applyKey)) {
        skippedHistory += 1;
      } else {
        seenHistoryKeys.add(applyKey);
        history.push({
          identity_key: applyKey,
          legacy_memberid: legacyMemberId,
          category,
          transaction_date: transactionDate.value,
          description: cell(row, "Description"),
          amount: amount.value,
          expiration_date: expirationDate.value,
          processor: cell(row, "Processor"),
          source_record_id: cell(row, "SourceRecordID"),
          item_id: cell(row, "ItemID"),
          transaction_id: cell(row, "TransactionID"),
          source_file: historySourceFile,
          lineNumber,
        });
      }
    }
  });

  const duplicateCustomerLegacyMemberIds = [...customerIds.entries()]
    .filter(([, count]) => count > 1)
    .map(([legacyMemberId, count]) => ({ legacyMemberId, count }))
    .sort((a, b) => b.count - a.count || a.legacyMemberId.localeCompare(b.legacyMemberId));

  const duplicateCustomerEmails = duplicatesFromCounts(emails).map((entry) => ({
    email: entry.key,
    count: entry.count,
    legacyMemberIds: entry.extras,
  }));

  const duplicateHistoryIdentityCandidates = [...identityCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([identityKey, count]) => ({
      identityKey: identityKey.replaceAll(IDENTITY_SEPARATOR, " | ") || "(blank)",
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  return {
    dryRun: {
      mode: "dry-run",
      customersFile,
      historyFile,
      customerRowCount: customersCsv.rows.length,
      uniqueLegacyMemberIdCount: customerIds.size,
      historyRowCount: historyCsv.rows.length,
      countsByCategory: countBy(categoryValues),
      orphanHistoryCount: orphans.length,
      orphanHistorySample: orphans.slice(0, SAMPLE_LIMIT),
      duplicateCustomerLegacyMemberIds,
      duplicateCustomerEmails,
      blankCustomerEmailCount,
      identityCandidates,
      chosenIdentityKey: chosenIdentity.name,
      chosenIdentityFields: chosenIdentity.fields,
      duplicateHistoryIdentityCandidates,
      invalidCategoryCount: [...invalidCategoryCounts.values()].reduce((sum, count) => sum + count, 0),
      invalidCategories: [...invalidCategoryCounts.entries()].map(([category, count]) => ({
        category,
        count,
      })),
      malformedDateCount,
      malformedAmountCount,
      rejectedRowCount: rejectedRows.length,
      rejectedRows: rejectedRows.slice(0, 50),
      parseRejectedCustomerCount: customersCsv.rejectedRows.length,
      parseRejectedHistoryCount: historyCsv.rejectedRows.length,
    },
    customers,
    history,
    skippedCustomers,
    skippedHistory,
  };
}

export function dryRunWatsonLegacyHistory(options: {
  customersPath: string;
  historyPath: string;
}): WatsonLegacyHistoryDryRunReport {
  return prepareWatsonLegacyHistoryImport(options).dryRun;
}

export function formatWatsonLegacyHistoryDryRunReport(
  report: WatsonLegacyHistoryDryRunReport,
): string {
  const lines = [
    "Watson cleaned legacy history import — DRY RUN (no database writes)",
    `Customers file: ${report.customersFile}`,
    `History file: ${report.historyFile}`,
    "",
    `Customer rows: ${report.customerRowCount}`,
    `Unique LegacyMemberID count: ${report.uniqueLegacyMemberIdCount}`,
    `Duplicate customer LegacyMemberIDs: ${report.duplicateCustomerLegacyMemberIds.length}`,
    `Blank customer emails: ${report.blankCustomerEmailCount}`,
    `Duplicate customer emails: ${report.duplicateCustomerEmails.length}`,
    "",
    `History rows: ${report.historyRowCount}`,
    "Counts by Category:",
    ...Object.entries(report.countsByCategory)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, count]) => `  - ${category}: ${count}`),
    `Orphan history records: ${report.orphanHistoryCount}`,
    `Invalid categories: ${report.invalidCategoryCount}`,
    `Malformed dates: ${report.malformedDateCount}`,
    `Malformed amounts: ${report.malformedAmountCount}`,
    "",
    "History identity uniqueness (do not assume TransactionID or SourceRecordID is unique):",
    ...report.identityCandidates.map(
      (candidate) =>
        `  - ${candidate.name}: ${candidate.unique ? "UNIQUE" : `NOT unique (${candidate.duplicateCount} rows in duplicate keys, ${candidate.blankKeyCount} blank)`}`,
    ),
    `Chosen identity key: ${report.chosenIdentityKey}`,
    `Duplicate history identity candidates: ${report.duplicateHistoryIdentityCandidates.length}`,
    "",
    `Rejected rows: ${report.rejectedRowCount}`,
    `CSV parse rejects — customers: ${report.parseRejectedCustomerCount}, history: ${report.parseRejectedHistoryCount}`,
  ];

  if (report.duplicateCustomerLegacyMemberIds.length > 0) {
    lines.push("", "Duplicate LegacyMemberIDs:");
    for (const row of report.duplicateCustomerLegacyMemberIds.slice(0, SAMPLE_LIMIT)) {
      lines.push(`  - ${row.legacyMemberId} (${row.count})`);
    }
  }
  if (report.duplicateCustomerEmails.length > 0) {
    lines.push("", "Duplicate customer emails:");
    for (const row of report.duplicateCustomerEmails.slice(0, SAMPLE_LIMIT)) {
      lines.push(`  - ${row.email} (${row.count}) ids=${row.legacyMemberIds.join(",")}`);
    }
  }
  if (report.orphanHistorySample.length > 0) {
    lines.push("", "Orphan history sample:");
    for (const row of report.orphanHistorySample) {
      lines.push(`  - line ${row.lineNumber}: ${row.legacyMemberId}`);
    }
  }
  if (report.invalidCategories.length > 0) {
    lines.push("", "Invalid category values:");
    for (const row of report.invalidCategories) {
      lines.push(`  - ${row.category}: ${row.count}`);
    }
  }
  if (report.duplicateHistoryIdentityCandidates.length > 0) {
    lines.push("", "Duplicate identity samples:");
    for (const row of report.duplicateHistoryIdentityCandidates.slice(0, SAMPLE_LIMIT)) {
      lines.push(`  - ${row.identityKey} (${row.count})`);
    }
  }
  if (report.rejectedRows.length > 0) {
    lines.push("", "Rejected row sample:");
    for (const row of report.rejectedRows.slice(0, SAMPLE_LIMIT)) {
      lines.push(`  - ${row.file} line ${row.lineNumber}: ${row.reason}`);
    }
  }

  lines.push(
    "",
    `Apply identity key (locked): ${HISTORY_IDENTITY_APPLY.name}`,
    "Default mode is dry-run. Writes require an explicit --apply flag.",
    "This dry-run does not write to Postgres.",
  );
  return lines.join("\n");
}

function formatWriteCounts(label: string, counts: WatsonLegacyTableWriteCounts): string[] {
  return [
    `${label}:`,
    `  CSV rows: ${counts.csvRowCount}`,
    `  Inserted: ${counts.inserted}`,
    `  Updated: ${counts.updated}`,
    `  Upserted: ${counts.upserted}`,
    `  Skipped: ${counts.skipped}`,
  ];
}

export function formatWatsonLegacyHistoryApplyReport(
  report: WatsonLegacyHistoryApplyReport,
): string {
  const lines = [
    `Watson cleaned legacy history import — APPLY (${report.status})`,
    `Database target: ${report.databaseTarget}`,
    `Tables: watson_legacy_customers, watson_legacy_history`,
    `Batch: ${report.batchId}`,
    `Customers file: ${report.customersFile}`,
    `History file: ${report.historyFile}`,
    `Apply identity key: ${HISTORY_IDENTITY_APPLY.name}`,
    "",
    ...formatWriteCounts("Customers (watson_legacy_customers)", report.customers),
    "",
    ...formatWriteCounts("History (watson_legacy_history)", report.history),
    "",
    "Does not truncate or write legacy_* dump tables.",
    "Does not modify Memberstack, Stripe, ActiveCampaign, or current membership data.",
  ];
  if (report.errorMessage) {
    lines.push("", report.errorMessage);
  }
  return lines.join("\n");
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
  query: LegacyHistoryQueryFn,
  table: string,
  insertColumns: readonly string[],
  conflictColumn: string,
  updateColumns: readonly string[],
  rows: Array<Record<string, unknown>>,
  onProgress?: (message: string) => void,
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;
  for (let index = 0; index < rows.length; index += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(index, index + UPSERT_BATCH_SIZE);
    const sql = buildUpsertSql(
      table,
      insertColumns,
      conflictColumn,
      updateColumns,
      batch.length,
    );
    const result = await query(sql, flattenRowParams(batch, insertColumns));
    const counted = countUpsertResult(result.rows);
    inserted += counted.inserted;
    updated += counted.updated;
    onProgress?.(
      `${table}: upserted ${Math.min(index + batch.length, rows.length)} / ${rows.length}`,
    );
  }
  return { inserted, updated };
}

function defaultBatchId(customersPath: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `legacy-history-${path.basename(customersPath, path.extname(customersPath))}-${stamp}`;
}

type PgPoolConfig = {
  connectionString: string;
  connectionTimeoutMillis: number;
};

type PgPool = {
  connect: () => Promise<PgClient & { release: () => void }>;
  end: () => Promise<void>;
};

async function loadPg(): Promise<{ Pool: new (config: PgPoolConfig) => PgPool }> {
  const pg = await import("pg");
  return pg as { Pool: new (config: PgPoolConfig) => PgPool };
}

async function withLegacyHistoryClient<T>(
  databaseUrl: string,
  queryFn: LegacyHistoryQueryFn | undefined,
  fn: (query: LegacyHistoryQueryFn) => Promise<T>,
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

export async function applyWatsonLegacyHistory(options: {
  customersPath: string;
  historyPath: string;
  databaseUrl: string;
  batchId?: string;
  queryFn?: LegacyHistoryQueryFn;
  onProgress?: (message: string) => void;
}): Promise<WatsonLegacyHistoryApplyReport> {
  const prepared = prepareWatsonLegacyHistoryImport({
    customersPath: options.customersPath,
    historyPath: options.historyPath,
  });
  const batchId = options.batchId ?? defaultBatchId(options.customersPath);
  const databaseTarget = formatDatabaseTarget(options.databaseUrl);
  const abortReason = applyAbortReason(prepared.dryRun);

  const base = {
    mode: "apply" as const,
    databaseTarget,
    customersFile: prepared.dryRun.customersFile,
    historyFile: prepared.dryRun.historyFile,
    batchId,
    dryRun: prepared.dryRun,
  };

  if (abortReason) {
    return {
      ...base,
      status: "aborted",
      customers: emptyWriteCounts(prepared.dryRun.customerRowCount, prepared.skippedCustomers),
      history: emptyWriteCounts(prepared.dryRun.historyRowCount, prepared.skippedHistory),
      errorMessage: abortReason,
    };
  }

  const customerValues = prepared.customers.map((row) => ({
    ...row,
    batch_id: batchId,
  }));
  const historyValues = prepared.history.map((row) => ({
    ...row,
    batch_id: batchId,
  }));

  try {
    return await withLegacyHistoryClient(options.databaseUrl, options.queryFn, async (query) => {
      await query("BEGIN");
      try {
        await applyWatsonLegacyHistorySchema(
          { query: (sql) => query(sql) },
          { onProgress: options.onProgress },
        );
        const customerWrites = await upsertBatches(
          query,
          "watson_legacy_customers",
          CUSTOMER_INSERT_COLUMNS,
          "legacy_memberid",
          CUSTOMER_UPDATE_COLUMNS,
          customerValues,
          options.onProgress,
        );
        const historyWrites = await upsertBatches(
          query,
          "watson_legacy_history",
          HISTORY_INSERT_COLUMNS,
          "identity_key",
          HISTORY_UPDATE_COLUMNS,
          historyValues,
          options.onProgress,
        );
        await query("COMMIT");
        return {
          ...base,
          status: "completed" as const,
          customers: {
            csvRowCount: prepared.dryRun.customerRowCount,
            inserted: customerWrites.inserted,
            updated: customerWrites.updated,
            upserted: customerWrites.inserted + customerWrites.updated,
            skipped: prepared.skippedCustomers,
          },
          history: {
            csvRowCount: prepared.dryRun.historyRowCount,
            inserted: historyWrites.inserted,
            updated: historyWrites.updated,
            upserted: historyWrites.inserted + historyWrites.updated,
            skipped: prepared.skippedHistory,
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
      customers: emptyWriteCounts(prepared.dryRun.customerRowCount, prepared.skippedCustomers),
      history: emptyWriteCounts(prepared.dryRun.historyRowCount, prepared.skippedHistory),
      errorMessage: `Failed: ${errorMessage}`,
    };
  }
}
