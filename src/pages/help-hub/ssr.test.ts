import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(here, "index.astro"), "utf8");
const slugSource = readFileSync(join(here, "[slug].astro"), "utf8");
const previewSource = readFileSync(join(here, "preview.astro"), "utf8");

describe("Help Hub public SSR", () => {
  it("server-renders the index from published database content", () => {
    expect(indexSource).toContain("export const prerender = false");
    expect(indexSource).toContain("loadPublicHelpHubTips");
    expect(indexSource).not.toMatch(/from ["'].*help-hub\.json["']/);
  });

  it("404s unpublished slugs and uses the shared tip renderer", () => {
    expect(slugSource).toContain("export const prerender = false");
    expect(slugSource).toContain("publicOnly: true");
    expect(slugSource).toContain("HelpHubTipPage");
    expect(slugSource).not.toMatch(/from ["'].*help-hub\.json["']/);
  });

  it("renders authenticated preview with the same HelpHubTipPage implementation", () => {
    expect(previewSource).toContain("requireAdminForRequest");
    expect(previewSource).toContain("HelpHubTipPage");
    expect(previewSource).toContain("preview={true}");
    expect(previewSource).toContain("loadHelpHubTipBySlug");
  });
});
