import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const headerSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "Header.astro"),
  "utf8",
);

/** Isolate the Help Hub dropdown panel markup for order-sensitive assertions. */
function helpHubPanel(): string {
  // The Help Hub trigger button carries data-testid="nav-help-hub"; the panel
  // is the following <ul class="nav-dropdown-menu dd-panel"> block.
  const triggerIdx = headerSource.indexOf('data-testid="nav-help-hub"');
  expect(triggerIdx).toBeGreaterThan(-1);
  const panelStart = headerSource.indexOf("<ul", triggerIdx);
  const panelEnd = headerSource.indexOf("</ul>", panelStart);
  expect(panelStart).toBeGreaterThan(-1);
  expect(panelEnd).toBeGreaterThan(panelStart);
  return headerSource.slice(panelStart, panelEnd + "</ul>".length);
}

describe("Header Help Hub navigation dropdown", () => {
  it("keeps Help Hub first, What's New second, and Tip of the Week third", () => {
    const panel = helpHubPanel();

    const helpHubLinkIdx = panel.indexOf('href="/help-hub"');
    const whatsNewLinkIdx = panel.indexOf('href="/whats-new"');
    const tipLinkIdx = panel.indexOf('href="/tip-of-the-week"');

    expect(helpHubLinkIdx).toBeGreaterThan(-1);
    expect(whatsNewLinkIdx).toBeGreaterThan(-1);
    expect(tipLinkIdx).toBeGreaterThan(-1);
    // Help Hub stays first; What's New second; Tip of the Week third.
    expect(whatsNewLinkIdx).toBeGreaterThan(helpHubLinkIdx);
    expect(tipLinkIdx).toBeGreaterThan(whatsNewLinkIdx);

    // The What's New item uses the shared dropdown item markup and its own testid.
    expect(panel).toMatch(
      /<li><a href="\/whats-new" data-testid="nav-whats-new">What's New<\/a><\/li>/,
    );
    expect(panel).toMatch(
      /data-testid="nav-tip-of-the-week"[\s\S]*?>\s*Tip of the Week\s*</,
    );
  });

  it("exposes What's New to everyone (not member-gated) and always visible", () => {
    const panel = helpHubPanel();
    const whatsNewLi =
      panel.match(/<li[^>]*>\s*<a href="\/whats-new"[\s\S]*?<\/a>\s*<\/li>/)?.[0] ?? "";

    expect(whatsNewLi).not.toBe("");
    // No membership gating hooks and not hidden.
    expect(whatsNewLi).not.toMatch(/data-ms-/);
    expect(whatsNewLi).not.toContain("is-hidden");
  });

  it("exposes Tip of the Week to everyone (not member-gated) and always visible", () => {
    const panel = helpHubPanel();
    const tipLi =
      panel.match(
        /<li[^>]*>\s*<a href="\/tip-of-the-week"[\s\S]*?<\/a>\s*<\/li>/,
      )?.[0] ?? "";

    expect(tipLi).not.toBe("");
    expect(tipLi).not.toMatch(/data-ms-/);
    expect(tipLi).not.toContain("is-hidden");
  });

  it("adds exactly one What's New navigation entry", () => {
    const testIds = [...headerSource.matchAll(/data-testid="nav-whats-new"/g)];
    expect(testIds).toHaveLength(1);
    const links = [...headerSource.matchAll(/href="\/whats-new"/g)];
    expect(links).toHaveLength(1);
  });

  it("adds exactly one Tip of the Week navigation entry", () => {
    const testIds = [...headerSource.matchAll(/data-testid="nav-tip-of-the-week"/g)];
    expect(testIds).toHaveLength(1);
    const links = [...headerSource.matchAll(/href="\/tip-of-the-week"/g)];
    expect(links).toHaveLength(1);
  });

  it("preserves the shared dropdown structure and accessibility of the Help Hub menu", () => {
    // The dropdown trigger keeps its ARIA and shared dd behavior classes.
    expect(headerSource).toMatch(
      /class="nav-link nav-dropdown-toggle dd-trigger"[\s\S]*?aria-haspopup="true"[\s\S]*?aria-expanded="false"/,
    );
    // The panel keeps its menu role and shared dropdown classes.
    const panel = helpHubPanel();
    expect(panel).toContain('class="nav-dropdown-menu dd-panel"');
    expect(panel).toContain('role="menu"');
  });
});

describe("Header mobile drawer visible-viewport sizing", () => {
  it("keeps .kbm-nav-row as the scroll container with border-box and svh fallback", () => {
    const mobileDrawerBlock = headerSource.match(
      /\.kbm-nav-row\s*\{[\s\S]*?\.kbm-nav-row\.mobile-open/,
    )?.[0];
    expect(mobileDrawerBlock).toBeTruthy();
    expect(mobileDrawerBlock).toContain("overflow-y: auto");
    expect(mobileDrawerBlock).toContain("box-sizing: border-box");
    expect(mobileDrawerBlock).toContain(
      "var(--mobile-drawer-max-height, calc(100svh - var(--header-height, 90px)))",
    );
    expect(mobileDrawerBlock).toContain("calc(56px + env(safe-area-inset-bottom, 0px))");
  });

  it("wires visualViewport sync on open and imports the shared viewport helper", () => {
    expect(headerSource).toContain('from "../lib/mobileNavDrawerViewport"');
    expect(headerSource).toContain("attachMobileDrawerViewportListeners");
    expect(headerSource).toContain("computeMobileDrawerMaxHeightPx");
    expect(headerSource).toContain("kbm:mobile-nav-viewport-sync");
    expect(headerSource).toContain("window.visualViewport");
    // Preserve existing header-bottom measurement into --header-height.
    expect(headerSource).toContain('setProperty("--header-height"');
  });
});

describe("Header green-bar search button replaces terracotta strip", () => {
  it("removes the site-wide .kbm-search-strip markup and styles", () => {
    expect(headerSource).not.toContain("kbm-search-strip");
    expect(headerSource).not.toContain("kbm-search-bar");
    expect(headerSource).not.toContain('id="openSearchModal"');
  });

  it("exposes accessible magnifying-glass triggers that open the shared Pagefind modal", () => {
    expect(headerSource).toContain('id="searchModal"');
    expect(headerSource).toContain('id="pagefind-search"');
    expect(headerSource).toContain("data-open-search-modal");
    expect(headerSource).toContain('aria-label="Search Knit It Now"');
    expect(headerSource).toContain('data-testid="header-search"');
    expect(headerSource).toContain('data-testid="header-search-mobile"');
    expect(headerSource).toContain("kbm-header-search--desktop");
    expect(headerSource).toContain("kbm-header-search--mobile");
    // Desktop vs mobile visibility is CSS-scoped (no second search system).
    expect(headerSource).toMatch(
      /@media\s*\(min-width:\s*1280px\)\s*\{[\s\S]*\.kbm-header-search--desktop\s*\{[\s\S]*display:\s*inline-flex/,
    );
    expect(headerSource).toMatch(
      /@media\s*\(max-width:\s*1279px\)\s*\{[\s\S]*\.kbm-header-search--mobile\s*\{[\s\S]*display:\s*inline-flex/,
    );
  });

  it("keeps Escape-to-close and restores focus to the search trigger", () => {
    expect(headerSource).toContain('e.key !== "Escape"');
    expect(headerSource).toContain("lastSearchTrigger");
    expect(headerSource).toContain("restore.focus");
    expect(headerSource).toContain('querySelectorAll("[data-open-search-modal]")');
  });

  it("keeps visible hover and focus styles on the green-bar search button", () => {
    expect(headerSource).toMatch(
      /\.kbm-header-search:hover\s*\{[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.15\)/,
    );
    expect(headerSource).toMatch(
      /\.kbm-header-search:focus(?:-visible)?\s*,?\s*\.kbm-header-search:focus-visible\s*\{[\s\S]*outline:\s*2px solid/,
    );
  });
});
