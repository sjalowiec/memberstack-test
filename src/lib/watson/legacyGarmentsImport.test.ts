import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { LEGACY_TABLE_DEFINITIONS, LEGACY_TABLE_LOAD_ORDER } from "./tableDefinitions";
import { getWatsonNativeSchemaStatements } from "./schema";
import {
  applyWatsonLegacyGarments,
  dryRunWatsonLegacyGarments,
  resolveLegacyGarmentsCsvPath,
  type LegacyGarmentsQueryFn,
} from "./legacyGarmentsImport";

const GARMENT_COLUMNS = [
  "garment_id",
  "garment_title",
  "garment_description",
  "source_file",
  "batch_id",
] as const;

function writeCsv(dir: string, name: string, contents: string): string {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, contents, "utf8");
  return filePath;
}

function writeCleanGarmentsCsv(dir: string, name = "legacy-garments.csv"): string {
  return writeCsv(
    dir,
    name,
    [
      "GarmentID,GarmentTitle,GarmentDescription",
      '2196,Carnation,"Basic <b>DROP SHOULDER</b> Pullover or Cardigan sweater<br> <div>Your choice:<ul><li>Round or V-neck</li><li>Optional bust darts</li></ul></div>"',
      '2194,Rose,"Basic <b>SET IN SLEEVE</b> sweater<br><ul><li>Pullover or cardigan</li></ul>"',
      "769,Mauve Pullover,",
      "194,Women's Elongated Stitches Cardigan,",
    ].join("\n"),
  );
}

function createFakeLegacyGarmentsDb() {
  const garments = new Map<string, Record<string, unknown>>();
  const statements: Array<{ sql: string; params?: unknown[] }> = [];

  const query: LegacyGarmentsQueryFn = async (sql, params) => {
    statements.push({ sql, params });
    const normalized = sql.trim();
    if (normalized === "BEGIN" || normalized === "COMMIT" || normalized === "ROLLBACK") {
      return { rows: [] };
    }
    if (/^CREATE\b/i.test(normalized) || /^COMMENT\b/i.test(normalized) || /^ALTER\b/i.test(normalized)) {
      return { rows: [] };
    }
    if (sql.includes("ON CONFLICT") && sql.includes("watson_legacy_garments")) {
      const rows: Array<{ inserted: boolean }> = [];
      const values = params ?? [];
      for (let index = 0; index < values.length; index += GARMENT_COLUMNS.length) {
        const record: Record<string, unknown> = {};
        GARMENT_COLUMNS.forEach((column, columnIndex) => {
          record[column] = values[index + columnIndex];
        });
        const key = String(record.garment_id);
        const existed = garments.has(key);
        garments.set(key, record);
        rows.push({ inserted: !existed });
      }
      return { rows };
    }
    throw new Error(`Unexpected SQL in fake Watson DB: ${sql}`);
  };

  return { query, statements, garments };
}

describe("legacy garments importer", () => {
  it("keeps cleaned garments out of the dump truncate/import list", () => {
    const dumpTables = LEGACY_TABLE_DEFINITIONS.map((def) => def.pgTable);
    expect(dumpTables).not.toContain("watson_legacy_garments");
    expect(LEGACY_TABLE_LOAD_ORDER).not.toContain("watson_legacy_garments");

    const nativeSql = getWatsonNativeSchemaStatements()
      .map((statement) => statement.sql)
      .join("\n");
    expect(nativeSql).toContain("CREATE TABLE IF NOT EXISTS watson_legacy_garments");
    expect(nativeSql).toContain("garment_id TEXT PRIMARY KEY");
    expect(nativeSql).toContain("garment_title");
    expect(nativeSql).toContain("garment_description TEXT");
    expect(nativeSql).toMatch(
      /ALTER TABLE watson_legacy_garments ADD COLUMN IF NOT EXISTS garment_description TEXT/,
    );
  });

  it("dry-run reports unique GarmentIDs without writing", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "watson-legacy-garments-dry-"));
    const garmentsPath = writeCleanGarmentsCsv(dir);

    const report = dryRunWatsonLegacyGarments({ garmentsPath });

    expect(report.mode).toBe("dry-run");
    expect(report.csvRowCount).toBe(4);
    expect(report.uniqueGarmentIdCount).toBe(4);
    expect(report.preparedRowCount).toBe(4);
    expect(report.rejectedRowCount).toBe(0);
    expect(report.duplicateGarmentIds).toEqual([]);
    expect(report.descriptionCount).toBe(2);
    expect(report.blankDescriptionCount).toBe(2);
  });

  it("dry-run skips later duplicate GarmentIDs and rejects blank titles", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "watson-legacy-garments-dup-"));
    const garmentsPath = writeCsv(
      dir,
      "legacy-garments.csv",
      [
        "GarmentID,GarmentTitle",
        "2196,Carnation",
        "2196,Carnation Updated",
        ",Missing ID",
        "999,",
      ].join("\n"),
    );

    const report = dryRunWatsonLegacyGarments({ garmentsPath });

    expect(report.csvRowCount).toBe(4);
    expect(report.uniqueGarmentIdCount).toBe(2);
    expect(report.preparedRowCount).toBe(1);
    expect(report.skippedDuplicateCount).toBe(1);
    expect(report.blankGarmentIdCount).toBe(1);
    expect(report.blankGarmentTitleCount).toBe(1);
    expect(report.rejectedRowCount).toBe(2);
    expect(report.duplicateGarmentIds).toEqual([{ garmentId: "2196", count: 2 }]);
  });

  it("resolves legacy-garments.csv first, then dated legacy_garments files", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "watson-legacy-garments-resolve-"));
    const dated = writeCsv(dir, "legacy_garments_2026-08-26.csv", "GarmentID,GarmentTitle\n1,One");
    const preferred = writeCsv(dir, "legacy-garments.csv", "GarmentID,GarmentTitle\n2,Two");

    expect(resolveLegacyGarmentsCsvPath({ dir })).toBe(preferred);

    fs.unlinkSync(preferred);
    expect(resolveLegacyGarmentsCsvPath({ dir })).toBe(dated);
  });

  it("upserts garments by GarmentID and is idempotent on re-apply", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "watson-legacy-garments-apply-"));
    const garmentsPath = writeCleanGarmentsCsv(dir);
    const db = createFakeLegacyGarmentsDb();

    const first = await applyWatsonLegacyGarments({
      garmentsPath,
      databaseUrl: "postgresql://watson@localhost:5432/watson",
      batchId: "test-garments-1",
      queryFn: db.query,
    });

    expect(first.status).toBe("completed");
    expect(first.garments).toEqual({
      csvRowCount: 4,
      inserted: 4,
      updated: 0,
      upserted: 4,
      skipped: 0,
    });
    expect(db.garments.size).toBe(4);
    expect(db.garments.get("2196")?.garment_title).toBe("Carnation");
    expect(String(db.garments.get("2196")?.garment_description)).toContain("DROP SHOULDER");
    expect(String(db.garments.get("2196")?.garment_description)).not.toContain("<b>");
    expect(db.garments.get("769")?.garment_description).toBeNull();
    expect(db.statements.some((statement) => statement.sql.includes("watson_legacy_customers"))).toBe(
      false,
    );
    expect(db.statements.some((statement) => /\bTRUNCATE\b/i.test(statement.sql))).toBe(false);
    expect(db.statements.some((statement) => statement.sql.includes("garment_description"))).toBe(
      true,
    );

    const updatedPath = writeCsv(
      dir,
      "legacy-garments.csv",
      [
        "GarmentID,GarmentTitle,GarmentDescription",
        '2196,Carnation,"Updated <b>DROP SHOULDER</b> description<br>Still plain text"',
        '2194,Rose,"Basic <b>SET IN SLEEVE</b> sweater<br><ul><li>Pullover or cardigan</li></ul>"',
        "769,Mauve Pullover,",
        "194,Women's Elongated Stitches Cardigan,",
      ].join("\n"),
    );

    const second = await applyWatsonLegacyGarments({
      garmentsPath: updatedPath,
      databaseUrl: "postgresql://watson@localhost:5432/watson",
      batchId: "test-garments-2",
      queryFn: db.query,
    });

    expect(second.status).toBe("completed");
    expect(second.garments).toEqual({
      csvRowCount: 4,
      inserted: 0,
      updated: 4,
      upserted: 4,
      skipped: 0,
    });
    expect(db.garments.size).toBe(4);
    expect(String(db.garments.get("2196")?.garment_description)).toContain("Updated");
    expect(String(db.garments.get("2196")?.garment_description)).toContain("Still plain text");
    expect(String(db.garments.get("2196")?.garment_description)).not.toContain("<b>");
  });

  it("aborts apply when the CSV has rejected rows", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "watson-legacy-garments-abort-"));
    const garmentsPath = writeCsv(
      dir,
      "legacy-garments.csv",
      ["GarmentID,GarmentTitle", "2196,Carnation", "999,"].join("\n"),
    );
    const db = createFakeLegacyGarmentsDb();

    const report = await applyWatsonLegacyGarments({
      garmentsPath,
      databaseUrl: "postgresql://watson@localhost:5432/watson",
      batchId: "test-garments-abort",
      queryFn: db.query,
    });

    expect(report.status).toBe("aborted");
    expect(db.garments.size).toBe(0);
    expect(report.errorMessage).toMatch(/rejected row/i);
  });
});
