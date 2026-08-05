import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const layoutSource = readFileSync(join(dir, "Layout.astro"), "utf8");
const headerSource = readFileSync(join(dir, "../components/Header.astro"), "utf8");

describe("header offset after search-strip removal", () => {
  it("does not floor measured --header-offset at the old strip-inclusive 170px", () => {
    expect(layoutSource).toContain("Math.max(72, measured)");
    expect(layoutSource).not.toMatch(/Math\.max\(fallback,\s*measured\)/);
    expect(layoutSource).toMatch(/const fallback = 100/);
    expect(layoutSource).toContain("--header-offset: 100px");
  });

  it("keeps the shared header fixed (no shrink-on-scroll)", () => {
    expect(headerSource).toMatch(/\.kbm-header-wrap\s*\{[^}]*position:\s*fixed/s);
    expect(headerSource).not.toContain("shrink-on-scroll");
    expect(layoutSource).not.toContain("isPatternWorkspaceDesktop");
  });
});
