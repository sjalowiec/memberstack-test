import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const previewSource = readFileSync(join(here, "preview.astro"), "utf8");
const tipPageSource = readFileSync(
  join(here, "..", "..", "components", "help-hub", "HelpHubTipPage.astro"),
  "utf8",
);

describe("Help Hub saved-draft preview", () => {
  it("requires admin auth and loads a saved slug", () => {
    expect(previewSource).toContain("requireAdminForRequest");
    expect(previewSource).toContain('searchParams.get("slug")');
    expect(previewSource).toContain("HelpHubTipPage");
    expect(previewSource).toContain("preview={true}");
    expect(previewSource).not.toContain("searchParams.get(\"data\")");
  });

  it("reuses the public Help Hub renderer", () => {
    expect(tipPageSource).toContain("data-hh-lesson-cta");
    expect(tipPageSource).toContain("/help-hub/work-with-sue");
    expect(tipPageSource).not.toMatch(/href="\/join"/);
  });
});
