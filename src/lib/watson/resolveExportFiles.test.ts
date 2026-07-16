import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  extractFilenameDate,
  fileMatchesExportName,
  resolveExportFiles,
  selectNewestMatchingFile,
} from "./resolveExportFiles";
import { LEGACY_TABLE_DEFINITIONS } from "./tableDefinitions";

describe("resolveExportFiles", () => {
  // Export CSVs are gitignored local fixtures; skip when the directory is absent.
  const exportDir20260711 = path.resolve("legacy-data/exports/2026-07-11");
  const hasLocalExportFixture = fs.existsSync(exportDir20260711);

  it.skipIf(!hasLocalExportFixture)(
    "finds all eight 2026-07-11 export files by table-name prefix",
    () => {
      const { resolved, missingRequired } = resolveExportFiles(
        exportDir20260711,
        LEGACY_TABLE_DEFINITIONS,
      );

      expect(missingRequired).toEqual([]);
      expect(resolved).toHaveLength(8);
      expect(resolved.every((entry) => entry.fileName.endsWith("_2026-07-11.csv"))).toBe(true);
    },
  );

  it("matches export prefixes case-insensitively", () => {
    expect(fileMatchesExportName("pattern_library_2026-07-11.csv", "Pattern_Library")).toBe(
      true,
    );
    expect(fileMatchesExportName("Members.csv", "Members")).toBe(true);
    expect(
      fileMatchesExportName("Store_Transactions_items_2026-07-11.csv", "Store_Transactions"),
    ).toBe(true);
    expect(
      fileMatchesExportName("Store_Transactions_items_2026-07-11.csv", "Store_Transactions_items"),
    ).toBe(true);
  });

  it("assigns overlapping prefixes to the most specific export first", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "watson-resolve-"));
    try {
      fs.writeFileSync(path.join(tempDir, "Store_Transactions_2026-06-01.csv"), "h\n");
      fs.writeFileSync(path.join(tempDir, "Store_Transactions_items_2026-07-11.csv"), "h\n");

      const { resolved, missingRequired } = resolveExportFiles(
        tempDir,
        LEGACY_TABLE_DEFINITIONS.filter((def) =>
          ["Store_Transactions", "Store_Transactions_items"].includes(def.exportName),
        ),
      );

      expect(missingRequired).toEqual([]);
      expect(resolved).toEqual([
        expect.objectContaining({
          exportName: "Store_Transactions_items",
          fileName: "Store_Transactions_items_2026-07-11.csv",
        }),
        expect.objectContaining({
          exportName: "Store_Transactions",
          fileName: "Store_Transactions_2026-06-01.csv",
        }),
      ]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("chooses the newest dated file when multiple matches exist", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "watson-resolve-"));
    try {
      fs.writeFileSync(path.join(tempDir, "Members_2026-06-01.csv"), "h\n");
      fs.writeFileSync(path.join(tempDir, "Members_2026-07-11.csv"), "h\n");

      const selected = selectNewestMatchingFile(tempDir, "Members", [
        "Members_2026-06-01.csv",
        "Members_2026-07-11.csv",
      ]);

      expect(selected?.fileName).toBe("Members_2026-07-11.csv");
      expect(selected?.alternateMatches).toEqual(["Members_2026-06-01.csv"]);
      expect(selected?.selectionReason).toContain("newest match among 2 files");
      expect(selected?.selectionReason).toContain("2026-07-11");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("falls back to file modified time when no snapshot date is present", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "watson-resolve-"));
    try {
      const olderPath = path.join(tempDir, "Members.csv");
      const newerPath = path.join(tempDir, "Members_backup.csv");
      fs.writeFileSync(olderPath, "h\n");
      fs.writeFileSync(newerPath, "h\n");

      const olderTime = new Date("2026-01-01T00:00:00.000Z");
      const newerTime = new Date("2026-07-01T00:00:00.000Z");
      fs.utimesSync(olderPath, olderTime, olderTime);
      fs.utimesSync(newerPath, newerTime, newerTime);

      const selected = selectNewestMatchingFile(tempDir, "Members", [
        "Members.csv",
        "Members_backup.csv",
      ]);

      expect(selected?.fileName).toBe("Members_backup.csv");
      expect(selected?.selectionReason).toContain("file modified time");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("extracts snapshot dates from dated filenames", () => {
    expect(extractFilenameDate("Members_2026-07-11.csv")?.toISOString()).toBe(
      "2026-07-11T00:00:00.000Z",
    );
    expect(extractFilenameDate("Members.csv")).toBeNull();
  });
});
