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
  it("keeps Help Hub first and adds What's New second, linking to /whats-new", () => {
    const panel = helpHubPanel();

    const helpHubLinkIdx = panel.indexOf('href="/help-hub"');
    const whatsNewLinkIdx = panel.indexOf('href="/whats-new"');

    expect(helpHubLinkIdx).toBeGreaterThan(-1);
    expect(whatsNewLinkIdx).toBeGreaterThan(-1);
    // Help Hub stays the first item; What's New is the second.
    expect(whatsNewLinkIdx).toBeGreaterThan(helpHubLinkIdx);

    // The What's New item uses the shared dropdown item markup and its own testid.
    expect(panel).toMatch(
      /<li><a href="\/whats-new" data-testid="nav-whats-new">What's New<\/a><\/li>/,
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

  it("adds exactly one What's New navigation entry", () => {
    const testIds = [...headerSource.matchAll(/data-testid="nav-whats-new"/g)];
    expect(testIds).toHaveLength(1);
    const links = [...headerSource.matchAll(/href="\/whats-new"/g)];
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
