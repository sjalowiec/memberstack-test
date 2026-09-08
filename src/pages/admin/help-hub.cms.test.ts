import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const editSource = readFileSync(join(here, "help-hub-edit.astro"), "utf8");
const listSource = readFileSync(join(here, "help-hub.astro"), "utf8");

describe("Help Hub admin CMS", () => {
  it("loads and saves through the admin API with a Memberstack bearer token", () => {
    expect(editSource).toContain("loadHelpHubTipBySlug");
    expect(editSource).toContain("getAdminAuthHeaders");
    expect(editSource).toContain("/api/admin/help-hub");
    expect(editSource).not.toContain("src/data/help-hub.json");
    expect(editSource).not.toContain("Copy Cursor Save Prompt");
  });

  it("exposes Preview for saved drafts using the authenticated preview route", () => {
    expect(editSource).toContain('id="previewHelpHub"');
    expect(editSource).toContain("/help-hub/preview?slug=");
    expect(listSource).toContain("/help-hub/preview?slug=");
    expect(listSource).toContain("loadHelpHubTipsForAdmin");
  });
});
