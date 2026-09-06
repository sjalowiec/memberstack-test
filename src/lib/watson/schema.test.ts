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
  getWatsonLegacyHistorySchemaStatements,
  getWatsonLegacyGarmentsSchemaStatements,
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
    const labels = nativeStatements.map((statement) => statement.label);
    expect(nativeStatements[0]?.label).toBe("table watson_notes");
    expect(nativeStatements[0]?.sql).toContain("CREATE TABLE IF NOT EXISTS watson_notes");
    expect(labels).toContain("table watson_store_fulfillments");
    expect(labels).toContain("table watson_shopify_orders");
    expect(labels).toContain("table watson_shopify_order_items");
    expect(labels).toContain("table watson_shopify_sync_runs");
    expect(labels).toContain("table watson_dak_licenses");
    expect(labels).toContain("table watson_legacy_customers");
    expect(labels).toContain("table watson_legacy_history");
    expect(labels).toContain("table watson_legacy_garments");
    const historySchema = getWatsonLegacyHistorySchemaStatements();
    expect(historySchema.map((statement) => statement.label)).toEqual(
      expect.arrayContaining([
        "table watson_legacy_customers",
        "table watson_legacy_history",
      ]),
    );
    expect(historySchema.some((statement) => statement.label.includes("renewal_reminders"))).toBe(
      false,
    );
    expect(historySchema.some((statement) => statement.label.includes("garments"))).toBe(false);
    const historySql = historySchema.map((statement) => statement.sql).join("\n");
    expect(historySql).not.toMatch(/\bTRUNCATE\b/i);
    expect(historySql).not.toContain("legacy_members");
    expect(historySql).toMatch(/CREATE TABLE IF NOT EXISTS watson_legacy_customers/);
    expect(historySql).toMatch(/CREATE TABLE IF NOT EXISTS watson_legacy_history/);
    const garmentsSchema = getWatsonLegacyGarmentsSchemaStatements();
    expect(garmentsSchema.map((statement) => statement.label)).toEqual([
      "table watson_legacy_garments",
      "alter watson_legacy_garments garment_description",
    ]);
    expect(garmentsSchema[0]?.sql).toMatch(/CREATE TABLE IF NOT EXISTS watson_legacy_garments/);
    expect(garmentsSchema[0]?.sql).toContain("garment_id TEXT PRIMARY KEY");
    expect(garmentsSchema[0]?.sql).toContain("garment_title");
    expect(garmentsSchema[0]?.sql).toContain("garment_description TEXT");
    expect(garmentsSchema[1]?.sql).toMatch(
      /ALTER TABLE watson_legacy_garments ADD COLUMN IF NOT EXISTS garment_description TEXT/,
    );
    expect(labels).toContain("table watson_whats_new_cards");
    expect(labels).toContain("table watson_whats_new_settings");
    expect(labels).toContain("alter watson_whats_new_settings billboard columns");
    expect(labels).toContain("alter watson_tip_of_the_week cta columns");
    expect(
      nativeStatements.find((statement) => statement.label === "table watson_whats_new_cards")?.sql,
    ).toContain("board_column TEXT NOT NULL");
    expect(
      nativeStatements.find((statement) => statement.label === "table watson_whats_new_settings")
        ?.sql,
    ).toContain("button_destination_url TEXT");
    expect(
      nativeStatements.find((statement) => statement.label === "table watson_store_fulfillments")
        ?.sql,
    ).toContain("actual_shipping_cost NUMERIC(12, 4)");
    expect(nativeStatements.some((statement) => statement.label.includes("order_tracking_unique"))).toBe(
      true,
    );
    expect(
      nativeStatements.find((statement) => statement.label === "table watson_shopify_orders")?.sql,
    ).toContain("source TEXT NOT NULL DEFAULT 'shopify'");
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
