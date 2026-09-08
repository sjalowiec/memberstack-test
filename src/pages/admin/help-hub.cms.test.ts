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
    expect(editSource).toContain("installHelpHubAdminBrowser");
    expect(editSource).toContain("admin.request");
    expect(editSource).toContain("admin.saveSucceeded");
    expect(editSource).toContain("admin.openPreview");
    expect(editSource).toContain("admin.promptSignIn");
    expect(editSource).toContain('id="helpHubAdminSignIn"');
    expect(editSource).not.toContain("catch (authErr) {}");
    expect(editSource).not.toContain('import("../../lib/admin/adminAuthClient")');
    expect(editSource).not.toContain("src/data/help-hub.json");
    expect(editSource).not.toContain("Copy Cursor Save Prompt");
  });

  it("exposes Preview through the authenticated admin client, not a public query string", () => {
    expect(editSource).toContain('id="previewHelpHub"');
    expect(editSource).toContain("admin.openPreview");
    expect(editSource).toContain("prepareApiPayload(form)");
    expect(editSource).not.toContain("admin.previewUrl(String(slug))");
    expect(editSource).not.toContain("window.open(admin.previewUrl");
    expect(listSource).toContain("data-help-hub-preview-slug");
    expect(listSource).toContain("bindHelpHubPreviewButtons");
    expect(listSource).not.toContain("/help-hub/preview?slug=");
    expect(listSource).toContain("loadHelpHubTipsForAdmin");
  });
});
