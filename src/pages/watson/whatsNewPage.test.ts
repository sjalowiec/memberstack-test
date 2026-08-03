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

  it("renders public card descriptions through the sanitizer, never raw DB HTML", () => {
    expect(publicPage).toContain("sanitizeCardDescriptionHtml");
    // Public boundary re-sanitizes before injecting formatted markup.
    expect(publicPage).toMatch(
      /class="whats-new__card-desc"[\s\S]*?set:html=\{sanitizeCardDescriptionHtml\(card\.description\)\}/,
    );
    // The old raw interpolation is gone.
    expect(publicPage).not.toContain('class="whats-new__card-desc">{card.description}');
    // Formatted children get compact spacing via :global rules.
    expect(publicPage).toMatch(/\.whats-new__card-desc\s*:global\(ul\)/);
  });

  it("gives the compact card editor the supported toolbar without a link button", () => {
    const cardRte = fs.readFileSync(
      path.resolve("src/scripts/watsonCardRichText.ts"),
      "utf8",
    );
    // The card description field is a compact rich-text editor with a hidden input.
    expect(page).toContain("data-wn-card-rte");
    expect(page).toContain("watson-wn__rte--compact");
    expect(page).toMatch(/data-wn-rte-input\s+name="description"/);
    // Toolbar exposes bold, italic, bulleted list, numbered list, and clear only.
    const rteIdx = page.indexOf("data-wn-card-rte");
    const rteBlock = page.slice(rteIdx, page.indexOf("</textarea>", rteIdx));
    expect(rteBlock).toContain('data-wn-rte-cmd="bold"');
    expect(rteBlock).toContain('data-wn-rte-cmd="italic"');
    expect(rteBlock).toContain('data-wn-rte-cmd="ul"');
    expect(rteBlock).toContain('data-wn-rte-cmd="ol"');
    expect(rteBlock).toContain('data-wn-rte-cmd="clear"');
    expect(rteBlock).not.toContain('data-wn-rte-cmd="link"');
    // Card editor reuses the shared sanitizer for descriptions.
    expect(cardRte).toContain("sanitizeCardDescriptionHtml");
    expect(cardRte).toContain("initCompactRichText");
    expect(page).toContain("initWatsonCardRichText");
  });

  it("loads and syncs saved descriptions when adding or editing an update", () => {
    // Seeds the editor for both create and edit, and syncs before saving.
    expect(script).toContain("setCardDescription");
    expect(script).toContain("syncCardDescription");
    expect(script).toContain("sanitizeCardDescriptionHtml");
    expect(script).toMatch(/setCardDescription\(form, String\(card\.description/);
    // Admin previews show a safe plain-text summary rather than raw markup.
    expect(page).toContain("cardDescriptionPlainText(card.description)");
    expect(page).not.toContain("<p>{card.description}</p>");
  });

  it("renders a registered tool icon on public cards only when one resolves", () => {
    expect(publicPage).toContain("resolveWhatsNewToolIcon");
    expect(publicPage).toContain("const toolIcon = resolveWhatsNewToolIcon(card)");
    // The icon <img> is rendered only inside the truthy guard (no empty placeholder).
    expect(publicPage).toMatch(
      /toolIcon \?\s*\(\s*<img[\s\S]*?class="whats-new__tool-icon"[\s\S]*?alt=""/,
    );
    // Decorative icon: empty alt, and no external/placeholder fallback branch.
    expect(publicPage).not.toMatch(/whats-new__tool-icon[\s\S]*?alt="[^"]+"/);
    // Compact, non-distorting sizing.
    expect(publicPage).toMatch(
      /\.whats-new__tool-icon\s*\{[^}]*width:\s*48px[^}]*height:\s*48px[^}]*object-fit:\s*contain/,
    );
  });

  it("shows the resolved tool icon in the Watson board preview without extra admin steps", () => {
    expect(page).toContain("resolveWhatsNewToolIcon");
    expect(page).toContain("const toolIcon = resolveWhatsNewToolIcon(card)");
    // Guarded render, decorative alt, no icon input field added to the form.
    expect(page).toMatch(
      /toolIcon \?\s*\(\s*<img[\s\S]*?class="watson-wn__tool-icon"[\s\S]*?alt=""/,
    );
    expect(page).not.toContain('name="icon"');
    expect(page).not.toContain('name="toolIcon"');
  });

  it("collapses the billboard into a native details accordion by default", () => {
    // Native <details> with our hook, collapsed (no `open`) by default.
    expect(page).toMatch(
      /<details[^>]*class="watson__panel watson-wn__billboard"[^>]*data-wn-billboard-panel/,
    );
    const detailsTag = page.match(/<details[^>]*data-wn-billboard-panel[^>]*>/)?.[0] ?? "";
    expect(detailsTag).not.toMatch(/\sopen(\s|=|>)/);
    // Preserves the existing panel styling/border.
    expect(detailsTag).toContain("watson__panel");
    // Uses a <summary> trigger and does not force a large collapsed height.
    expect(page).toContain("watson-wn__billboard-summary");
    expect(page).toMatch(/\.watson-wn__billboard-summary\s*\{[^}]*padding:\s*0\.1rem 0/);
  });

  it("summarizes billboard status, headline, and last updated with an edit cue", () => {
    const summary = page.slice(page.indexOf("<summary"), page.indexOf("</summary>"));
    expect(summary).toContain("What's New Billboard");
    expect(summary).toContain('billboard?.enabled ? "Enabled" : "Disabled"');
    // Headline shown only when present.
    expect(summary).toContain("billboard?.headline ?");
    expect(summary).toContain("{billboard.headline}");
    // Last updated shown only when present, using the shared quiet-date format.
    expect(summary).toContain("billboard?.updatedAt ?");
    expect(summary).toContain("Last updated");
    expect(summary).toContain("formatQuietPublishDate(billboard.updatedAt.slice(0, 10))");
    // Clear cue to open the editor.
    expect(summary).toContain("Edit billboard");
  });

  it("keeps the full billboard form inside the accordion so opening reveals it", () => {
    const detailsIdx = page.indexOf("data-wn-billboard-panel");
    const summaryClose = page.indexOf("</summary>", detailsIdx);
    const bodyIdx = page.indexOf("watson-wn__billboard-body", detailsIdx);
    const formIdx = page.indexOf("data-wn-video-form", detailsIdx);
    const detailsClose = page.indexOf("</details>", detailsIdx);
    expect(summaryClose).toBeGreaterThan(detailsIdx);
    expect(bodyIdx).toBeGreaterThan(summaryClose);
    expect(formIdx).toBeGreaterThan(bodyIdx);
    expect(detailsClose).toBeGreaterThan(formIdx);
  });

  it("keeps the billboard rich-text editor inside the accordion, initialized at load", () => {
    const detailsIdx = page.indexOf("data-wn-billboard-panel");
    const detailsClose = page.indexOf("</details>", detailsIdx);
    const rteIdx = page.indexOf("data-wn-rte", detailsIdx);
    // The billboard RTE wrap lives within the details, so expanding shows a live editor.
    expect(rteIdx).toBeGreaterThan(detailsIdx);
    expect(rteIdx).toBeLessThan(detailsClose);
    // Editor is wired at document scope, so a collapsed accordion is still seeded on load.
    expect(page).toContain("initWatsonBillboardRichText(document)");
  });

  it("saves the billboard normally and returns to collapsed after success", () => {
    expect(script).toContain('jsonFetch("/api/watson/whats-new/settings", "PUT", payload)');
    // Success reloads the page, which renders the accordion collapsed again.
    const afterSave = script.slice(script.indexOf("/api/watson/whats-new/settings"));
    expect(afterSave).toContain("window.location.reload()");
  });

  it("forces the billboard accordion open and focuses the error on a failed save", () => {
    expect(script).toContain('closest<HTMLDetailsElement>("[data-wn-billboard-panel]")');
    expect(script).toContain("panel.open = true");
    expect(script).toContain("videoStatus.focus()");
    // The status target is focusable so the error can receive focus.
    expect(page).toMatch(/data-wn-video-status[^>]*tabindex="-1"/);
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
