import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const layoutSource = readFileSync(join(dir, "Layout.astro"), "utf8");
const headerSource = readFileSync(join(dir, "../components/Header.astro"), "utf8");
const phoneWorkspaceCss = readFileSync(
  join(dir, "../styles/patterns/pattern-phone-workspace.css"),
  "utf8",
);
const headerNavTest = readFileSync(join(dir, "../components/HeaderNav.test.ts"), "utf8");

describe("ordinary pages retain fixed shared header", () => {
  it("keeps the site-wide .kbm-header-wrap fixed by default (not pattern-scoped)", () => {
    // Default rule must remain fixed so non-pattern pages are unchanged.
    expect(headerSource).toMatch(
      /\.kbm-header-wrap\s*\{[^}]*position:\s*fixed/s,
    );
    // Ordinary fixed rule is not rewritten onto body.page--pattern-workspace alone.
    expect(headerSource).not.toMatch(
      /body\.page--pattern-workspace\s+\.kbm-header-wrap\s*\{[^}]*position:\s*fixed/s,
    );
  });

  it("does not zero ordinary-page header offset measurement", () => {
    // Ordinary path still measures and floors at the 170px fallback.
    expect(layoutSource).toContain("const fallback = 170");
    expect(layoutSource).toContain("Math.max(fallback, measured)");
  });
});

describe("pattern-workspace desktop header scrolls away", () => {
  it("scopes non-fixed header to body.page--pattern-workspace at min-width 1025px", () => {
    expect(layoutSource).toMatch(
      /@media\s*\(min-width:\s*1025px\)\s*\{[\s\S]*body\.page--pattern-workspace\s+\.kbm-header-wrap\s*\{[\s\S]*position:\s*relative/s,
    );
    expect(layoutSource).toContain("top: auto !important");
  });

  it("clears the env banner with header margin (not a second main gap)", () => {
    expect(layoutSource).toMatch(
      /html\[data-kbm-env-banner="on"\]\s+body\.page--pattern-workspace\s+\.kbm-header-wrap\s*\{[\s\S]*margin-top:\s*var\(--kbm-env-banner-h/s,
    );
    expect(layoutSource).toMatch(
      /body\.page--pattern-workspace\s+main\.site-content\s*\{[\s\S]*padding-top:\s*var\(--header-buffer/s,
    );
  });

  it("sets desktop pattern-workspace --header-offset to 0 in CSS and JS", () => {
    expect(layoutSource).toContain("isPatternWorkspaceDesktop");
    expect(layoutSource).toMatch(
      /isPatternWorkspaceDesktop[\s\S]*setProperty\("--header-offset",\s*"0px"\)/s,
    );
    expect(layoutSource).toMatch(
      /@media\s*\(min-width:\s*1025px\)\s*\{[\s\S]*body\.page--pattern-workspace\s*\{[\s\S]*--header-offset:\s*0px/s,
    );
  });
});

describe("pattern-workspace phone + drawer contracts stay intact", () => {
  it("keeps phone compact search-strip hide and provisional phone offset", () => {
    expect(phoneWorkspaceCss).toContain("max-width: 767.98px");
    expect(phoneWorkspaceCss).toContain("body.page--pattern-workspace .kbm-search-strip");
    expect(phoneWorkspaceCss).toContain("display: none !important");
    expect(layoutSource).toMatch(
      /@media\s*\(max-width:\s*767\.98px\)\s*\{[\s\S]*body\.page--pattern-workspace\s*\{[\s\S]*--header-offset:\s*64px/s,
    );
    expect(layoutSource).toContain("isPatternWorkspacePhone");
  });

  it("does not unfix the header inside the mobile drawer breakpoint (≤1024px)", () => {
    // Non-fixed override must stay behind min-width: 1025px so drawer top/height
    // continue to use the fixed header bottom measurement.
    const desktopBlock = layoutSource.match(
      /@media\s*\(min-width:\s*1025px\)\s*\{[\s\S]*?body\.page--pattern-workspace\s+\.kbm-header-wrap[\s\S]*?position:\s*relative/,
    )?.[0];
    expect(desktopBlock).toBeTruthy();
    expect(layoutSource).not.toMatch(
      /@media\s*\(max-width:\s*1024px\)[\s\S]*page--pattern-workspace[\s\S]*\.kbm-header-wrap[\s\S]*position:\s*relative/,
    );
  });

  it("keeps Header mobile drawer viewport sizing assertions covered", () => {
    // Regression guard: drawer tests remain part of the focused suite contract.
    expect(headerNavTest).toContain("Header mobile drawer visible-viewport sizing");
    expect(headerNavTest).toContain("attachMobileDrawerViewportListeners");
    expect(headerSource).toContain('from "../lib/mobileNavDrawerViewport"');
  });
});
