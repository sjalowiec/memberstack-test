import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function readRepo(pathFromSrc: string): string {
  return readFileSync(join(repoRoot, pathFromSrc), "utf-8");
}

describe("pattern builder My Patterns drawer wiring", () => {
  const builderPages = [
    "pages/patterns/sleeveless/builder.astro",
    "pages/patterns/drop-shoulder/builder.astro",
  ] as const;

  it.each(builderPages)("uses the shared library drawer trigger on %s", (page) => {
    const src = readRepo(page);
    expect(src).toContain("PatternBuilderMyPatternsLink");
    expect(src).not.toMatch(/account#my-patterns[\s\S]{0,120}My Patterns/);
  });

  it("wires PatternBuilderMyPatternsLink to the library drawer trigger", () => {
    const src = readRepo("components/patterns/PatternBuilderMyPatternsLink.astro");
    expect(src).toContain("data-pattern-workspace-library-trigger");
    expect(src).toContain('data-testid="pattern-workspace-library-trigger"');
    expect(src).not.toContain("/account#my-patterns");
  });

  it("routes the free-pattern locked screen through the upgrade screen to account My Patterns", () => {
    const guard = readRepo("lib/patterns/sleevelessNewPatternAccessGuard.ts");
    const upgradeScreen = readRepo("lib/patterns/patternBuilderNewPatternUpgradeScreen.ts");
    const upgradeConfig = readRepo("lib/patterns/patternBuilderUpgradeConfig.ts");

    expect(guard).toContain("mountPatternBuilderNewPatternUpgradeScreen");
    expect(upgradeScreen).toContain("PATTERN_BUILDER_SAVED_PATTERNS_HREF");
    expect(upgradeConfig).toContain('"/account#my-patterns"');
    expect(guard).not.toContain("data-pattern-workspace-library-trigger");
  });

  it("keeps a single drawer shell mounted via the site header", () => {
    expect(readRepo("components/Header.astro")).toContain("<PatternWorkspaceLibraryDrawer />");
    for (const page of builderPages) {
      expect(readRepo(page)).not.toContain("<PatternWorkspaceLibraryDrawer");
    }
  });
});
