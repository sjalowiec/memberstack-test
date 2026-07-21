import { describe, expect, it } from "vitest";

import { LEGACY_TABLE_DEFINITIONS } from "./tableDefinitions";
import {
  buildLegacySchemaSql,
  formatBlockingImportSessionsMessage,
  getLegacyIndexSchemaStatements,
  getLegacyMetadataSchemaStatements,
  getLegacySchemaStatements,
  getLegacyTableSchemaStatements,
  getWatsonNativeSchemaStatements,
} from "./schema";

describe("schema", () => {
  it("builds labeled statements for each legacy table, metadata table, and index", () => {
    const tableStatements = getLegacyTableSchemaStatements();
    expect(tableStatements).toHaveLength(LEGACY_TABLE_DEFINITIONS.length);
    expect(tableStatements[0]?.label).toBe("table legacy_members");
    expect(tableStatements[0]?.sql).toContain('CREATE TABLE IF NOT EXISTS "legacy_members"');

    const metadataStatements = getLegacyMetadataSchemaStatements();
    expect(metadataStatements).toHaveLength(2);
    expect(metadataStatements.map((statement) => statement.label)).toEqual([
      "table watson_import_runs",
      "table watson_import_run_tables",
    ]);

    const indexStatements = getLegacyIndexSchemaStatements();
    expect(indexStatements).toHaveLength(9);
    expect(indexStatements[0]?.label).toBe("index idx_legacy_members_email");

    const nativeStatements = getWatsonNativeSchemaStatements();
    expect(nativeStatements).toHaveLength(10);
    expect(nativeStatements[0]?.label).toBe("table watson_notes");
    expect(nativeStatements[0]?.sql).toContain("CREATE TABLE IF NOT EXISTS watson_notes");
    expect(nativeStatements[1]?.label).toBe("index idx_watson_notes_memberid_created");
    expect(nativeStatements[2]?.label).toBe("table watson_store_fulfillments");
    expect(nativeStatements[2]?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS watson_store_fulfillments",
    );
    expect(nativeStatements[2]?.sql).toContain("actual_shipping_cost NUMERIC(12, 4)");
    expect(nativeStatements.some((statement) => statement.label.includes("order_tracking_unique"))).toBe(
      true,
    );
  });

  it("keeps generated schema.sql content in sync with statement builders", () => {
    const combined = getLegacySchemaStatements()
      .map((statement) => `${statement.sql};`)
      .join("\n\n");
    expect(buildLegacySchemaSql(LEGACY_TABLE_DEFINITIONS).trim()).toBe(combined);
  });

  it("formats a blocking-session error without credentials", () => {
    const message = formatBlockingImportSessionsMessage([
      {
        pid: 16285,
        state: "idle in transaction",
        durationMs: 120_000,
        queryPreview: 'INSERT INTO "legacy_subscriptions"',
      },
    ]);
    expect(message).toContain("pid 16285");
    expect(message).toContain("pg_terminate_backend");
    expect(message).not.toContain("password");
  });
});
