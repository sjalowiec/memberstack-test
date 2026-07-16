import fs from "node:fs";
import path from "path";

import { describe, expect, it } from "vitest";

import { coerceCellValue } from "./coerceValue";
import { resolveSourceHeader } from "./columnNormalize";
import { readCsvFile } from "./csvReader";
import { getLegacyTableDefByPgTable } from "./tableDefinitions";

const ITEMS_CSV = path.resolve(
  "legacy-data/exports/2026-07-11/Store_Transactions_items_2026-07-11.csv",
);
// Export CSVs are gitignored local fixtures; skip file-backed cases when absent.
const hasItemsCsv = fs.existsSync(ITEMS_CSV);

function coerceCsvRows(pgTable: string, csvPath: string): {
  coerced: number;
  rejected: Array<{ lineNumber: number; reason: string }>;
} {
  const def = getLegacyTableDefByPgTable(pgTable);
  if (!def) {
    throw new Error(`Unknown table: ${pgTable}`);
  }

  const parsed = readCsvFile(csvPath);
  const headerIndex = new Map<string, string>();
  for (const header of parsed.headers) {
    headerIndex.set(header.toLowerCase(), header);
  }

  const rejected: Array<{ lineNumber: number; reason: string }> = [];
  let coerced = 0;

  for (let index = 0; index < parsed.rows.length; index++) {
    const sourceRow = parsed.rows[index];
    let rowFailed = false;

    for (const column of def.columns) {
      const sourceHeader = resolveSourceHeader(headerIndex, column.source);
      if (!sourceHeader) {
        rejected.push({
          lineNumber: index + 2,
          reason: `Missing expected CSV column: ${column.source}`,
        });
        rowFailed = true;
        break;
      }

      const result = coerceCellValue(sourceRow[sourceHeader], column);
      if (!result.ok) {
        rejected.push({
          lineNumber: index + 2,
          reason: result.reason,
        });
        rowFailed = true;
        break;
      }
    }

    if (!rowFailed) {
      coerced++;
    }
  }

  return { coerced, rejected };
}

describe("legacy_store_transaction_items import mapping", () => {
  it("maps line-item CSV headers instead of Store_Transactions header columns", () => {
    const def = getLegacyTableDefByPgTable("legacy_store_transaction_items");
    expect(def?.columns.some((column) => column.source === "TransactionID")).toBe(false);
    expect(def?.columns.some((column) => column.source === "Transaction_itemid")).toBe(true);
    expect(def?.columns.some((column) => column.source === "ItemName")).toBe(true);
  });

  it.skipIf(!hasItemsCsv)(
    "coerces all Store_Transactions_items export rows without rejection",
    () => {
      const { coerced, rejected } = coerceCsvRows(
        "legacy_store_transaction_items",
        ITEMS_CSV,
      );

      expect(rejected).toEqual([]);
      expect(coerced).toBe(30_137);
    },
  );

  it.skipIf(!hasItemsCsv)("coerces a representative line-item row", () => {
    const parsed = readCsvFile(ITEMS_CSV);
    const row = parsed.rows[0];
    const transactionItemId = coerceCellValue(row.Transaction_itemid, {
      source: "Transaction_itemid",
      pg: "transaction_itemid",
      type: "bigint",
      nullable: false,
    });
    const itemName = coerceCellValue(row.ItemName, {
      source: "ItemName",
      pg: "itemname",
      type: "text",
      nullable: true,
    });

    expect(transactionItemId).toEqual({ ok: true, value: 62 });
    expect(itemName).toEqual({ ok: true, value: "Angora (3/10)" });
  });
});
