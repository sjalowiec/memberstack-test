import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function readRepo(pathFromSrc: string): string {
  return readFileSync(join(repoRoot, pathFromSrc), "utf-8");
}

describe("pattern workspace library drawer mount", () => {
  it("mounts exactly one drawer shell via the site header", () => {
    expect(readRepo("components/Header.astro")).toContain("<PatternWorkspaceLibraryDrawer />");
  });

  it("does not mount duplicate drawer shells on pattern workspace pages", () => {
    const pages = [
      "pages/patterns/index.astro",
      "pages/patterns/about.astro",
      "pages/patterns/sleeveless-express.astro",
      "pages/patterns/sleeveless/builder.astro",
      "pages/patterns/sleeveless/pattern/index.astro",
      "pages/patterns/drop-shoulder/pattern/index.astro",
      "components/patterns/PatternTabs.astro",
    ];

    for (const page of pages) {
      const src = readRepo(page);
      expect(src, page).not.toContain("<PatternWorkspaceLibraryDrawer");
    }
  });

  it("renders the backdrop before the panel so the panel stays clickable", () => {
    const src = readRepo("components/patterns/PatternWorkspaceLibraryDrawer.astro");
    const backdropIdx = src.indexOf("data-pattern-workspace-library-backdrop");
    const panelIdx = src.indexOf('id="pattern-workspace-library-drawer-panel"');
    expect(backdropIdx).toBeGreaterThan(-1);
    expect(panelIdx).toBeGreaterThan(backdropIdx);
  });
});
