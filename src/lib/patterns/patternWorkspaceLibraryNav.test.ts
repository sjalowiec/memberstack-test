import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("main navigation My Patterns drawer trigger", () => {
  it("wires the header nav item to the pattern workspace library drawer", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const header = readFileSync(join(dir, "../../components/Header.astro"), "utf-8");

    expect(header).toContain('data-testid="nav-my-patterns"');
    expect(header).toContain('data-ms-content="members"');
    expect(header).toContain('data-testid="nav-patterns-about"');
    expect(header).not.toMatch(
      /<li[\s\S]*?data-ms-content="!members"[\s\S]*?data-testid="nav-patterns-about"/,
    );
    expect(header).toContain("data-pattern-workspace-library-trigger");
    expect(header).toContain('aria-controls="pattern-workspace-library-drawer-panel"');
    expect(header).not.toContain('href="/account#my-patterns" data-testid="nav-my-patterns"');
    expect(header).toContain("PatternWorkspaceLibraryDrawer");
  });
});
