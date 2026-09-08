import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const previewSource = readFileSync(join(here, "preview.astro"), "utf8");
const slugSource = readFileSync(join(here, "[slug].astro"), "utf8");
const tipPageSource = readFileSync(
  join(here, "..", "..", "components", "help-hub", "HelpHubTipPage.astro"),
  "utf8",
);

describe("Help Hub saved-draft preview", () => {
  it("requires admin auth on POST and never persists", () => {
    expect(previewSource).toContain("requireAdminForRequest");
    expect(previewSource).toContain("HelpHubTipPage");
    expect(previewSource).toContain("preview={true}");
    expect(previewSource).toContain("resolveHelpHubPreviewTip");
    expect(previewSource).toContain('Astro.request.method !== "POST"');
    expect(previewSource).not.toContain("saveNewHelpHubTip");
    expect(previewSource).not.toContain("saveExistingHelpHubTip");
    expect(previewSource).not.toContain("updateHelpHubTip");
    expect(previewSource).not.toContain("writeHelpHubFile");
    expect(previewSource).not.toContain('searchParams.get("data")');
  });

  it("reuses the public Help Hub renderer", () => {
    expect(slugSource).toContain("HelpHubTipPage");
    expect(tipPageSource).toContain("data-hh-lesson-cta");
    expect(tipPageSource).toContain("/help-hub/work-with-sue");
    expect(tipPageSource).not.toMatch(/href="\/join"/);
  });
});
