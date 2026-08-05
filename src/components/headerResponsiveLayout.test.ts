import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const headerSource = readFileSync(join(dir, "Header.astro"), "utf8");
const layoutSource = readFileSync(join(dir, "../layouts/Layout.astro"), "utf8");

describe("Header responsive layout breakpoints", () => {
  it("uses a single-row desktop flex layout from 1280px (covers 1280 and 1366)", () => {
    expect(headerSource).toMatch(
      /@media\s*\(min-width:\s*1280px\)\s*\{[\s\S]*\.kbm-nav-bar\s+\.kbm-container\s*\{[\s\S]*display:\s*flex[\s\S]*flex-wrap:\s*nowrap/,
    );
    // No higher “wide only” gate — 1366 is inside the single-row band.
    expect(headerSource).not.toMatch(/@media\s*\(min-width:\s*1401px\)/);
    expect(headerSource).not.toMatch(/@media\s*\(min-width:\s*1366px\)/);
  });

  it("uses compact hamburger/drawer layout at max-width 1279px", () => {
    expect(headerSource).toContain("KBM_HEADER_COMPACT_MAX_PX = 1279");
    expect(headerSource).toMatch(
      /@media\s*\(max-width:\s*1279px\)\s*\{[\s\S]*\.kbm-nav-bar\s+\.kbm-hamburger/,
    );
    expect(headerSource).toMatch(
      /innerWidth\s*<=\s*KBM_HEADER_COMPACT_MAX_PX/,
    );
    // Desktop hides hamburger; compact shows nav-right (search + hamburger).
    expect(headerSource).toMatch(
      /@media\s*\(min-width:\s*1280px\)\s*\{[\s\S]*\.kbm-nav-bar\s+\.kbm-hamburger\s*\{[\s\S]*display:\s*none/,
    );
  });

  it("removes the intermediate two-row header grid completely", () => {
    expect(headerSource).not.toMatch(/grid-template-areas:\s*[\s\S]*brand nav[\s\S]*secondary secondary/);
    expect(headerSource).not.toMatch(
      /@media\s*\(min-width:\s*1025px\)\s*and\s*\(max-width:\s*1400px\)/,
    );
    expect(headerSource).not.toContain("max-width: 1400px");
  });

  it("keeps logged-in and logged-out account controls reachable in both layouts", () => {
    // Desktop secondary zone (visible ≥1280) and drawer actions (≤1279).
    expect(headerSource).toContain("kbm-nav-secondary");
    expect(headerSource).toContain("kbm-header-auth");
    expect(headerSource).toContain('data-ms-content="!members"');
    expect(headerSource).toContain('data-ms-content="members"');
    expect(headerSource).toContain("kbm-drawer-actions");
    expect(headerSource).toContain("kbm-drawer-account");
    expect(headerSource).toMatch(
      /@media\s*\(max-width:\s*1279px\)\s*\{[\s\S]*\.kbm-nav-row\s+\.kbm-drawer-actions\s*\{[\s\S]*display:\s*flex/,
    );
  });

  it("preserves long account-name ellipsis without wrapping the header", () => {
    expect(headerSource).toMatch(
      /\.kbm-nav-bar\s+\.kbm-header-auth\s+\.kbm-header-account-btn\s*\{[\s\S]*max-width:\s*min\(13rem,\s*100%\)/,
    );
    expect(headerSource).toMatch(
      /\.kbm-header-account-name\s*\{[\s\S]*text-overflow:\s*ellipsis[\s\S]*white-space:\s*nowrap/,
    );
  });

  it("keeps search wired in both desktop and compact layouts", () => {
    expect(headerSource).toContain("kbm-header-search--desktop");
    expect(headerSource).toContain("kbm-header-search--mobile");
    expect(headerSource).toContain("data-open-search-modal");
    expect(headerSource).toContain('id="searchModal"');
    expect(headerSource).toMatch(
      /@media\s*\(min-width:\s*1280px\)\s*\{[\s\S]*\.kbm-header-search--desktop\s*\{[\s\S]*display:\s*inline-flex/,
    );
    expect(headerSource).toMatch(
      /@media\s*\(max-width:\s*1279px\)\s*\{[\s\S]*\.kbm-header-search--mobile\s*\{[\s\S]*display:\s*inline-flex/,
    );
  });

  it("keeps mobile drawer as the scroll container with visualViewport sizing", () => {
    const mobileDrawerBlock = headerSource.match(
      /\.kbm-nav-row\s*\{[\s\S]*?\.kbm-nav-row\.mobile-open/,
    )?.[0];
    expect(mobileDrawerBlock).toBeTruthy();
    expect(mobileDrawerBlock).toContain("overflow-y: auto");
    expect(mobileDrawerBlock).toContain(
      "var(--mobile-drawer-max-height, calc(100svh - var(--header-height, 90px)))",
    );
    expect(headerSource).toContain("attachMobileDrawerViewportListeners");
  });

  it("keeps pattern workspace header offsets measurement-based in Layout", () => {
    expect(layoutSource).toContain("getBoundingClientRect().height");
    expect(layoutSource).toContain('setProperty("--header-offset"');
    expect(layoutSource).toContain("isPatternWorkspacePhone");
    expect(layoutSource).toContain("Math.max(72, measured)");
  });
});
