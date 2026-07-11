import { describe, expect, it } from "vitest";

import { buildMultiRowInsertSql } from "./importBatch";

describe("importBatch inserts", () => {
  it("builds a multi-row INSERT with sequential placeholders", () => {
    const sql = buildMultiRowInsertSql("legacy_members", ["memberid", "email"], 2);
    expect(sql).toBe(
      'INSERT INTO "legacy_members" ("memberid", "email") VALUES ($1, $2), ($3, $4)',
    );
  });

  it("supports enough placeholders for legacy_members batch size", () => {
    const columns = Array.from({ length: 32 }, (_, index) => `col_${index}`);
    const sql = buildMultiRowInsertSql("legacy_members", columns, 500);
    expect(sql.match(/\(\$/g)?.length).toBe(500);
    expect(sql.match(/\$\d+/g)?.length).toBe(16_000);
  });
});
