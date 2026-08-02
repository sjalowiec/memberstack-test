import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

describe("Watson Whats New page", () => {
  const page = fs.readFileSync(path.resolve("src/pages/watson/whats-new.astro"), "utf8");
  const publicPage = fs.readFileSync(path.resolve("src/pages/whats-new.astro"), "utf8");
  const shell = fs.readFileSync(
    path.resolve("src/components/watson/WatsonPageShell.astro"),
    "utf8",
  );
  const script = fs.readFileSync(path.resolve("src/scripts/watsonWhatsNew.ts"), "utf8");

  it("is a server-rendered Watson page with board and add-update workflow", () => {
    expect(page).toContain('export const prerender = false');
    expect(page).toContain("WatsonPageShell");
    expect(page).toContain("Add Update");
    expect(page).toContain("data-wn-open-create");
    expect(page).toContain("WHATS_NEW_BOARD_COLUMNS");
    expect(page).toContain("boardColumnMeta");
    expect(page).toContain("What's New Billboard");
    expect(page).toContain("Archived items");
    expect(page).toContain("data-wn-move");
    expect(page).toContain("initWatsonWhatsNew");
    expect(shell).toContain('href="/watson/whats-new"');
  });

  it("wires create/update and archive/restore client actions", () => {
    expect(script).toContain("/api/watson/whats-new");
    expect(script).toContain("archive");
    expect(script).toContain("restore");
    expect(script).toContain("/api/watson/whats-new/settings");
  });

  it("offers permanent delete only for draft or archived cards", () => {
    expect(page).toContain("Delete permanently");
    expect(page).toContain("data-wn-delete");
    // Delete affordance is gated to draft/archived cards in the active board.
    expect(page).toContain('card.status === "draft" || card.archived');
    // Archived cards always expose delete.
    const archivedIdx = page.indexOf("watson-wn__archived");
    expect(page.indexOf("data-wn-delete", archivedIdx)).toBeGreaterThan(archivedIdx);
  });

  it("confirms permanent delete with the card title and can be cancelled", () => {
    expect(script).toContain("[data-wn-delete]");
    expect(script).toContain("window.confirm");
    expect(script).toContain("data-wn-title");
    expect(script).toContain("cannot be undone");
    // Cancelling leaves the card unchanged (early return without a request).
    expect(script).toContain("if (!confirmed) return");
    expect(script).toMatch(/"DELETE"/);
    // Success and error feedback is surfaced to the admin.
    expect(script).toContain("queueFlash");
    expect(script).toContain("Unable to delete card.");
  });

  it("removes the Watson New pill markup and styling", () => {
    expect(page).not.toContain("watson-wn__badge--new");
    expect(page).not.toContain("card.isNew");
    // Other meta affordances remain.
    expect(page).toContain("watson-wn__category");
    expect(page).toContain("watson-wn__badge--featured");
  });

  it("public page stacks board columns without horizontal scroll affordances", () => {
    expect(publicPage).toContain('export const prerender = false');
    expect(publicPage).toContain("whats-new__board");
    expect(publicPage).toContain("WHATS_NEW_BOARD_COLUMNS");
    expect(publicPage).toContain("boardColumnMeta");
    expect(publicPage).toContain("grid-template-columns: 1fr");
    expect(publicPage).toContain("repeat(3, minmax(0, 1fr))");
    expect(publicPage).not.toContain("overflow-x: auto");
    expect(publicPage).toContain("getPublicWhatsNewBoard");
    expect(publicPage).toContain("getPublicBillboardSettings");
  });

  it("uses the shared pinwheel palette helpers on public and Watson pages", () => {
    expect(publicPage).toContain("whatsNewThemeStyle");
    expect(publicPage).toContain("whatsNewCategoryCardStyle");
    expect(page).toContain("whatsNewThemeStyle");
    expect(page).toContain("whatsNewCategoryCardStyle");
    expect(page).toContain("WHATS_NEW_COLUMN_ACCENTS");
  });

  it("omits the public New pill and pipeline disclaimer while keeping Featured", () => {
    expect(publicPage).not.toContain("whats-new__badge--new");
    expect(publicPage).not.toContain("whats-new__column-note");
    expect(publicPage).not.toContain("Plans may change as ideas develop");
    expect(publicPage).toContain("whats-new__badge--featured");
    expect(publicPage).toContain("whats-new__category");
  });

  it("supports flexible public billboard layouts without empty placeholders", () => {
    expect(publicPage).toContain("whats-new__billboard");
    expect(publicPage).toContain("whats-new__billboard--with-video");
    expect(publicPage).toContain("whats-new__billboard--text");
    expect(publicPage).toContain("billboardHasVideo");
    expect(publicPage).toContain("billboardHasButton");
    expect(publicPage).toContain("getPublicBillboardSettings");
    expect(publicPage).toMatch(/@media \(max-width: 899px\)|grid-template-columns: 1fr/);
  });

  it("keeps text-only billboards single-column and full width without a media slot", () => {
    // Media markup is gated on video presence only.
    expect(publicPage).toMatch(/billboardVideo\s*\?\s*\(/);
    expect(publicPage).toContain("whats-new__billboard-media");

    // Text-only uses block layout (no reserved second column).
    expect(publicPage).toMatch(
      /\.whats-new__billboard--text\s*\{[^}]*display:\s*block/,
    );
    expect(publicPage).toMatch(
      /\.whats-new__billboard--text\s+\.whats-new__billboard-copy\s*\{[^}]*max-width:\s*none/,
    );

    // Message width is not artificially capped for the video layout.
    expect(publicPage).not.toMatch(
      /\.whats-new__billboard-message\s*\{[^}]*max-width:\s*40rem/,
    );

    // Two-column grid is only for the video layout at desktop widths.
    expect(publicPage).toMatch(
      /\.whats-new__billboard--with-video\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1\.15fr\)/,
    );
    expect(publicPage).not.toMatch(
      /\.whats-new__billboard--text\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax/,
    );
  });

  it("renders the public card description as normal body copy, keeping the title bold", () => {
    const descMatch = publicPage.match(/\.whats-new__card-desc\s*\{([^}]*)\}/);
    expect(descMatch).not.toBeNull();
    const descBody = descMatch![1];
    // Normal weight, forced to beat the global `.kbm-card { font-weight: 700 !important }`.
    expect(descBody).toMatch(/font-weight:\s*400\s*!important/);
    // Uses the normal site body-text color, not the card's green.
    expect(descBody).toMatch(/color:\s*#243015/);
    // Comfortable line-height for multi-line descriptions.
    expect(descBody).toMatch(/line-height:\s*1\.55/);

    // The title keeps its own styling and does not force a normal weight.
    const titleMatch = publicPage.match(/\.whats-new__card-title\s*\{([^}]*)\}/);
    expect(titleMatch).not.toBeNull();
    expect(titleMatch![1]).not.toMatch(/font-weight:\s*400/);
  });

  it("places the billboard above the board title, without a generic lead paragraph", () => {
    expect(publicPage).toContain("What's New at Knit It Now");
    expect(publicPage).toContain('title={`${pageTitle} | Knit it Now`}');
    expect(publicPage).not.toContain("whats-new__intro");
    expect(publicPage).not.toContain("colorful look");
    expect(publicPage).not.toContain("long changelog");
    expect(publicPage).toContain("whats-new--with-billboard");

    const billboardIdx = publicPage.indexOf("whats-new__billboard");
    const titleIdx = publicPage.indexOf("<h1>{pageTitle}</h1>");
    const boardIdx = publicPage.indexOf('class="whats-new__board"');
    expect(billboardIdx).toBeGreaterThan(-1);
    expect(titleIdx).toBeGreaterThan(billboardIdx);
    expect(boardIdx).toBeGreaterThan(titleIdx);
  });
});
