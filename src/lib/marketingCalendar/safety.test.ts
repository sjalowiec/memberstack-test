import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function source(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("marketing calendar stays unwired", () => {
  it("keeps the evening schedule off and the calendar writes behind the background lock", () => {
    const toml = source("netlify.toml");
    expect(toml).not.toContain("marketing-calendar-sync");
    expect(toml).toContain('LEGACY_RENEWAL_REMINDER_LIVE_ENABLED = "true"');
    expect(source("netlify/functions/marketing-calendar-sync.ts")).toContain("MARKETING_CALENDAR_SYNC_LIVE_ENABLED");
    expect(source("netlify/functions/marketing-calendar-sync.ts")).not.toContain("runMarketingCalendarSync");
    expect(source("netlify/functions/marketing-calendar-sync.ts")).not.toContain("allowWrites: true");
    const entryPoints = [
      "src/lib/marketingCalendar/runDryRun.ts",
      "src/lib/marketingCalendar/syncJob.ts",
      "netlify/functions/marketing-calendar-sync.ts",
      "netlify/functions/marketing-calendar-sync-background.ts",
    ].map(source);
    for (const file of entryPoints) {
      expect(file).not.toContain("applyMarketingCalendarPlan");
      expect(file).not.toContain("createGoogleCalendarWriter");
      expect(file).not.toContain("allowWrites: true");
      expect(file).not.toContain("deleteEvent");
    }
    const importer = source("src/lib/marketingCalendar/importApproved.ts");
    expect(importer).not.toContain("deleteEvent");
    const sync = source("src/lib/marketingCalendar/runSync.ts");
    expect(sync).not.toContain("deleteEvent");
    expect(source("src/lib/marketingCalendar/syncJob.ts")).toContain("dryRun: false");
    expect(source("src/lib/marketingCalendar/activeCampaignCampaigns.ts")).not.toContain('method: "POST"');
    expect(source("src/lib/marketingCalendar/activeCampaignCampaigns.ts")).not.toContain('method: "DELETE"');
    expect(source("src/lib/marketingCalendar/activeCampaignCampaigns.ts")).not.toContain('method: "PATCH"');
  });

  it("does not commit a private key or an ActiveCampaign token", () => {
    const tree = [
      "src/lib/marketingCalendar/constants.ts",
      "src/lib/marketingCalendar/serviceAccount.ts",
      "src/lib/marketingCalendar/googleCalendarClient.ts",
      "src/lib/marketingCalendar/runDryRun.ts",
      "netlify/functions/marketing-calendar-sync.ts",
    ]
      .map(source)
      .join("\n");
    expect(tree).not.toContain("-----BEGIN");
    expect(tree).not.toContain("ya29.");
    expect(tree).toContain("KIN marketing");
  });
});
