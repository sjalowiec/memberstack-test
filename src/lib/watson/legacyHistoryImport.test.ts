import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { LEGACY_TABLE_DEFINITIONS, LEGACY_TABLE_LOAD_ORDER } from "./tableDefinitions";
import { getWatsonNativeSchemaStatements } from "./schema";
import {
  chooseHistoryIdentityKey,
  dryRunWatsonLegacyHistory,
  applyWatsonLegacyHistory,
  inspectHistoryIdentity,
  parseOptionalAmount,
  parseOptionalDate,
  identityKeyForRow,
  type LegacyHistoryQueryFn,
} from "./legacyHistoryImport";
import { HISTORY_IDENTITY_APPLY, HISTORY_IDENTITY_CANDIDATES } from "./legacyHistoryTypes";

function writeCsv(dir: string, name: string, contents: string): string {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, contents, "utf8");
  return filePath;
}

describe("legacy history dry-run importer", () => {
  it("keeps cleaned tables out of the dump truncate/import list", () => {
    const dumpTables = LEGACY_TABLE_DEFINITIONS.map((def) => def.pgTable);
    expect(dumpTables).not.toContain("watson_legacy_customers");
    expect(dumpTables).not.toContain("watson_legacy_history");
    expect(dumpTables).not.toContain("watson_legacy_garments");
    expect(LEGACY_TABLE_LOAD_ORDER).not.toContain("watson_legacy_customers");
    expect(LEGACY_TABLE_LOAD_ORDER).not.toContain("watson_legacy_history");
    expect(LEGACY_TABLE_LOAD_ORDER).not.toContain("watson_legacy_garments");

    const nativeSql = getWatsonNativeSchemaStatements()
      .map((statement) => statement.sql)
      .join("\n");
    expect(nativeSql).toContain("CREATE TABLE IF NOT EXISTS watson_legacy_customers");
    expect(nativeSql).toContain("CREATE TABLE IF NOT EXISTS watson_legacy_history");
    expect(nativeSql).toContain("customer_notes");
    expect(nativeSql).toMatch(/CHECK \(category IN \('Membership', 'Course Purchase', 'Pattern Purchase', 'LK150 Bundle'\)\)/);
  });

  it("parses ISO and US dates and currency amounts", () => {
    expect(parseOptionalDate("2024-03-09", "DateJoined")).toEqual({
      ok: true,
      value: "2024-03-09",
    });
    expect(parseOptionalDate("3/9/2024", "TransactionDate")).toEqual({
      ok: true,
      value: "2024-03-09",
    });
    expect(parseOptionalDate("not-a-date", "ExpirationDate").ok).toBe(false);
    expect(parseOptionalAmount("$12.50")).toEqual({ ok: true, value: 12.5 });
    expect(parseOptionalAmount("")).toEqual({ ok: true, value: null });
    expect(parseOptionalAmount("abc").ok).toBe(false);
  });

  it("does not assume TransactionID or SourceRecordID is unique", () => {
    const rows = [
      {
        LegacyMemberID: "1",
        Category: "Membership",
        SourceRecordID: "S1",
        TransactionID: "T1",
        ItemID: "A",
      },
      {
        LegacyMemberID: "1",
        Category: "Course Purchase",
        SourceRecordID: "S1",
        TransactionID: "T1",
        ItemID: "B",
      },
    ];
    const reports = inspectHistoryIdentity(rows);
    const byName = Object.fromEntries(reports.map((row) => [row.name, row]));
    expect(byName.TransactionID?.unique).toBe(false);
    expect(byName.SourceRecordID?.unique).toBe(false);
    expect(byName["LegacyMemberID+SourceRecordID+TransactionID+Category+ItemID"]?.unique).toBe(
      true,
    );
    expect(chooseHistoryIdentityKey(reports).name).toBe(
      "LegacyMemberID+SourceRecordID+TransactionID+Category+ItemID",
    );
    expect(HISTORY_IDENTITY_CANDIDATES[0]?.name).toBe("TransactionID");
  });

  it("reports required dry-run stats without importing", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "watson-legacy-history-"));
    const customersPath = writeCsv(
      dir,
      "legacy_customers_2026-08-26.csv",
      [
        "LegacyMemberID,FirstName,Lastname,Email,DateJoined,CustomerNotes",
        "100,Jane,Doe,jane@example.com,2020-01-15,admin only note",
        "100,Jane,Doe,jane@example.com,2020-01-15,duplicate id",
        "200,John,Smith,,2020-02-01,",
        "300,Pat,Lee,shared@example.com,2021-05-05,",
        "400,Sam,Lee,shared@example.com,2021-06-06,",
        ",Missing,Id,x@example.com,2021-01-01,",
      ].join("\n"),
    );
    const historyPath = writeCsv(
      dir,
      "legacy_history_final_V3_2026-08-26.csv",
      [
        "LegacyMemberID,Category,TransactionDate,Description,Amount,ExpirationDate,Processor,SourceRecordID,ItemID,TransactionID",
        "100,Membership,2020-01-15,Annual,$19.99,2021-01-15,paypal,S1,I1,T1",
        "100,Course Purchase,3/9/2024,Course,25.00,,paypal,S1,I2,T1",
        "999,Pattern Purchase,2022-01-01,Orphan,10.00,,,S9,I9,T9",
        "200,Not A Category,2020-02-01,Bad cat,abc,not-a-date,paypal,S2,I3,T2",
      ].join("\n"),
    );

    const report = dryRunWatsonLegacyHistory({ customersPath, historyPath });
    expect(report.mode).toBe("dry-run");
    expect(report.customerRowCount).toBe(6);
    expect(report.uniqueLegacyMemberIdCount).toBe(4);
    expect(report.duplicateCustomerLegacyMemberIds).toEqual([
      { legacyMemberId: "100", count: 2 },
    ]);
    expect(report.blankCustomerEmailCount).toBe(1);
    expect(report.duplicateCustomerEmails.map((row) => row.email)).toEqual(
      expect.arrayContaining(["jane@example.com", "shared@example.com"]),
    );
    expect(report.historyRowCount).toBe(4);
    expect(report.countsByCategory.Membership).toBe(1);
    expect(report.countsByCategory["Course Purchase"]).toBe(1);
    expect(report.countsByCategory["Pattern Purchase"]).toBe(1);
    expect(report.countsByCategory["Not A Category"]).toBe(1);
    expect(report.orphanHistoryCount).toBe(1);
    expect(report.invalidCategoryCount).toBe(1);
    expect(report.malformedDateCount).toBeGreaterThan(0);
    expect(report.malformedAmountCount).toBe(1);
    expect(report.rejectedRowCount).toBeGreaterThan(0);
    expect(report.chosenIdentityKey).toBeTruthy();
    expect(report.identityCandidates.some((row) => row.name === "TransactionID")).toBe(true);
    expect(report.identityCandidates.some((row) => row.name === "SourceRecordID")).toBe(true);
  });
});

const CUSTOMER_COLUMNS = [
  "legacy_memberid",
  "first_name",
  "last_name",
  "email",
  "date_joined",
  "customer_notes",
  "source_file",
  "batch_id",
] as const;

const HISTORY_COLUMNS = [
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

function createFakeLegacyHistoryDb() {
  const customers = new Map<string, Record<string, unknown>>();
  const history = new Map<string, Record<string, unknown>>();
  const statements: Array<{ sql: string; params?: unknown[] }> = [];

  function upsert(
    store: Map<string, Record<string, unknown>>,
    keyColumn: string,
    columns: readonly string[],
    params: unknown[] = [],
  ) {
    const rows: Array<{ inserted: boolean }> = [];
    for (let index = 0; index < params.length; index += columns.length) {
      const record: Record<string, unknown> = {};
      columns.forEach((column, columnIndex) => {
        record[column] = params[index + columnIndex];
      });
      const key = String(record[keyColumn]);
      const existed = store.has(key);
      store.set(key, record);
      rows.push({ inserted: !existed });
    }
    return { rows };
  }

  const query: LegacyHistoryQueryFn = async (sql, params) => {
    statements.push({ sql, params });
    const normalized = sql.trim();
    if (normalized === "BEGIN" || normalized === "COMMIT" || normalized === "ROLLBACK") {
      return { rows: [] };
    }
    if (/^CREATE\b/i.test(normalized) || /^COMMENT\b/i.test(normalized)) {
      return { rows: [] };
    }
    if (sql.includes("ON CONFLICT") && sql.includes("watson_legacy_customers")) {
      return upsert(customers, "legacy_memberid", CUSTOMER_COLUMNS, params);
    }
    if (sql.includes("ON CONFLICT") && sql.includes("watson_legacy_history")) {
      return upsert(history, "identity_key", HISTORY_COLUMNS, params);
    }
    throw new Error(`Unexpected SQL in fake Watson DB: ${sql}`);
  };

  return { query, statements, customers, history };
}

function writeCleanApplyCsvs(dir: string): { customersPath: string; historyPath: string } {
  const customersPath = writeCsv(
    dir,
    "legacy_customers_2026-08-26.csv",
    [
      "LegacyMemberID,FirstName,Lastname,Email,DateJoined,CustomerNotes",
      '100,Jane,Doe," Jane@Example.COM ",2020-01-15,"Keep notes exactly"',
      "200,John,Smith,,2020-02-01,",
      "300,Pat,Lee,shared@example.com,2021-05-05,",
      "400,Sam,Lee,shared@example.com,2021-06-06,",
    ].join("\n"),
  );
  const historyPath = writeCsv(
    dir,
    "legacy_history_final_V3_2026-08-26.csv",
    [
      "LegacyMemberID,Category,TransactionDate,Description,Amount,ExpirationDate,Processor,SourceRecordID,ItemID,TransactionID",
      "100,Membership,2020-01-15,Annual,$19.99,2021-01-15,paypal,S1,I1,T1",
      "100,Course Purchase,3/9/2024,Course,25.00,,paypal,S1,I2,T2",
      "200,Pattern Purchase,2022-01-01,Pattern,10.00,,,S9,I9,T9",
      "400,LK150 Bundle,2021-06-06,Bundle,150,,paypal,S4,I4,T4",
    ].join("\n"),
  );
  return { customersPath, historyPath };
}

describe("legacy history apply importer", () => {
  it("upserts customers and history, then updates on re-run without duplicate rows", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "watson-legacy-apply-"));
    const { customersPath, historyPath } = writeCleanApplyCsvs(dir);
    const db = createFakeLegacyHistoryDb();

    const first = await applyWatsonLegacyHistory({
      customersPath,
      historyPath,
      databaseUrl: "postgresql://watson@localhost:5432/watson",
      batchId: "test-batch-1",
      queryFn: db.query,
    });

    expect(first.status).toBe("completed");
    expect(first.customers).toEqual({
      csvRowCount: 4,
      inserted: 4,
      updated: 0,
      upserted: 4,
      skipped: 0,
    });
    expect(first.history).toEqual({
      csvRowCount: 4,
      inserted: 4,
      updated: 0,
      upserted: 4,
      skipped: 0,
    });
    expect(db.customers.size).toBe(4);
    expect(db.history.size).toBe(4);

    const second = await applyWatsonLegacyHistory({
      customersPath,
      historyPath,
      databaseUrl: "postgresql://watson@localhost:5432/watson",
      batchId: "test-batch-2",
      queryFn: db.query,
    });

    expect(second.status).toBe("completed");
    expect(second.customers).toEqual({
      csvRowCount: 4,
      inserted: 0,
      updated: 4,
      upserted: 4,
      skipped: 0,
    });
    expect(second.history).toEqual({
      csvRowCount: 4,
      inserted: 0,
      updated: 4,
      upserted: 4,
      skipped: 0,
    });
    expect(db.customers.size).toBe(4);
    expect(db.history.size).toBe(4);
  });

  it("keeps duplicate emails as separate customers and preserves email and notes exactly", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "watson-legacy-apply-exact-"));
    const { customersPath, historyPath } = writeCleanApplyCsvs(dir);
    const db = createFakeLegacyHistoryDb();

    await applyWatsonLegacyHistory({
      customersPath,
      historyPath,
      databaseUrl: "postgresql://watson@localhost:5432/watson",
      batchId: "test-batch-exact",
      queryFn: db.query,
    });

    expect(db.customers.get("100")?.email).toBe(" Jane@Example.COM ");
    expect(db.customers.get("100")?.customer_notes).toBe("Keep notes exactly");
    expect(db.customers.get("200")?.email).toBe("");
    expect(db.customers.get("300")?.email).toBe("shared@example.com");
    expect(db.customers.get("400")?.email).toBe("shared@example.com");
    expect(db.customers.get("300")?.legacy_memberid).toBe("300");
    expect(db.customers.get("400")?.legacy_memberid).toBe("400");

    const membershipKey = identityKeyForRow(
      {
        LegacyMemberID: "100",
        SourceRecordID: "S1",
        TransactionID: "T1",
      },
      HISTORY_IDENTITY_APPLY.fields,
    );
    expect(db.history.get(membershipKey)?.identity_key).toBe(membershipKey);
    expect(db.history.get(membershipKey)?.legacy_memberid).toBe("100");
  });

  it("locks apply upserts to LegacyMemberID+SourceRecordID+TransactionID", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "watson-legacy-apply-key-"));
    const { customersPath, historyPath } = writeCleanApplyCsvs(dir);
    const db = createFakeLegacyHistoryDb();

    await applyWatsonLegacyHistory({
      customersPath,
      historyPath,
      databaseUrl: "postgresql://watson@localhost:5432/watson",
      batchId: "test-batch-key",
      queryFn: db.query,
    });

    const upsertSql = db.statements
      .filter((statement) => statement.sql.includes("ON CONFLICT"))
      .map((statement) => statement.sql)
      .join("\n");
    expect(upsertSql).toContain('ON CONFLICT ("legacy_memberid")');
    expect(upsertSql).toContain('ON CONFLICT ("identity_key")');
    expect(upsertSql).not.toContain("linked_memberstack_id");
    expect(upsertSql).not.toContain("link_status");
    expect(upsertSql).not.toContain("link_checked_at");

    const historyParams = db.statements.find(
      (statement) => statement.sql.includes("watson_legacy_history") && statement.sql.includes("ON CONFLICT"),
    )?.params ?? [];
    expect(historyParams[0]).toBe(
      identityKeyForRow(
        { LegacyMemberID: "100", SourceRecordID: "S1", TransactionID: "T1" },
        HISTORY_IDENTITY_APPLY.fields,
      ),
    );
  });

  it("aborts apply on duplicate customer LegacyMemberIDs without writing", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "watson-legacy-apply-dup-id-"));
    const customersPath = writeCsv(
      dir,
      "legacy_customers_2026-08-26.csv",
      [
        "LegacyMemberID,FirstName,Lastname,Email,DateJoined,CustomerNotes",
        "100,Jane,Doe,jane@example.com,2020-01-15,first",
        "100,Jane,Doe,jane@example.com,2020-01-15,second",
      ].join("\n"),
    );
    const historyPath = writeCsv(
      dir,
      "legacy_history_final_V3_2026-08-26.csv",
      [
        "LegacyMemberID,Category,TransactionDate,Description,Amount,ExpirationDate,Processor,SourceRecordID,ItemID,TransactionID",
        "100,Membership,2020-01-15,Annual,19.99,2021-01-15,paypal,S1,I1,T1",
      ].join("\n"),
    );

    const report = await applyWatsonLegacyHistory({
      customersPath,
      historyPath,
      databaseUrl: "postgresql://watson@localhost:5432/watson",
      queryFn: async () => {
        throw new Error("queryFn should not run when apply is aborted");
      },
    });

    expect(report.status).toBe("aborted");
    expect(report.customers.inserted).toBe(0);
    expect(report.errorMessage).toMatch(/duplicate LegacyMemberID/i);
  });

  it("aborts apply on rejected rows without writing", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "watson-legacy-apply-abort-"));
    const customersPath = writeCsv(
      dir,
      "legacy_customers_2026-08-26.csv",
      [
        "LegacyMemberID,FirstName,Lastname,Email,DateJoined,CustomerNotes",
        "100,Jane,Doe,jane@example.com,2020-01-15,note",
      ].join("\n"),
    );
    const historyPath = writeCsv(
      dir,
      "legacy_history_final_V3_2026-08-26.csv",
      [
        "LegacyMemberID,Category,TransactionDate,Description,Amount,ExpirationDate,Processor,SourceRecordID,ItemID,TransactionID",
        "999,Membership,2020-01-15,Orphan,10.00,,,S9,I9,T9",
      ].join("\n"),
    );

    const report = await applyWatsonLegacyHistory({
      customersPath,
      historyPath,
      databaseUrl: "postgresql://watson@localhost:5432/watson",
      queryFn: async () => {
        throw new Error("queryFn should not run when apply is aborted");
      },
    });

    expect(report.status).toBe("aborted");
    expect(report.customers.inserted).toBe(0);
    expect(report.history.inserted).toBe(0);
    expect(report.errorMessage).toMatch(/rejected row/i);
  });

  it("never issues TRUNCATE or writes to legacy_* dump tables", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "watson-legacy-apply-sql-"));
    const { customersPath, historyPath } = writeCleanApplyCsvs(dir);
    const db = createFakeLegacyHistoryDb();

    await applyWatsonLegacyHistory({
      customersPath,
      historyPath,
      databaseUrl: "postgresql://watson@localhost:5432/watson",
      batchId: "test-batch-sql",
      queryFn: db.query,
    });

    const sql = db.statements.map((statement) => statement.sql).join("\n");
    expect(sql).toMatch(/BEGIN/);
    expect(sql).toMatch(/COMMIT/);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toContain("legacy_members");
    expect(sql).not.toContain("legacy_subscriptions");
    expect(sql).toContain("watson_legacy_customers");
    expect(sql).toContain("watson_legacy_history");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS watson_legacy_customers");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS watson_legacy_history");
  });
});

