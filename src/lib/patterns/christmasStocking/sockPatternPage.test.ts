import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createEmptySockDraft } from "./sockDraft";
import { buildSockPatternFromDraft, buildSockPatternSummaryDlHtml } from "./sockPatternPage";
import { createSockSizingAdapter } from "./sockSizing";

const adapter = createSockSizingAdapter(
  JSON.parse(readFileSync(resolve("public/data/sizing_xmas_stockings.json"), "utf8")),
);

const patternPage = readFileSync(
  resolve("src/pages/patterns/christmas-stocking/pattern.astro"),
  "utf8",
);
const patternScript = readFileSync(
  resolve("src/scripts/christmas-stocking-pattern-page.ts"),
  "utf8",
);

function readyDraft(direction: "cuff-to-toe" | "toe-up") {
  return createEmptySockDraft({
    sizeSel: "med",
    constructionDirection: direction,
    footCircumference: "14",
    footLength: "9",
    legCircumference: "14",
    legLength: "12",
    gaugeSlots: { inches: { stitch: "28", row: "44" }, cm: { stitch: "", row: "" } },
    availableNeedles: "200",
  });
}

describe("Christmas stocking print summary", () => {
  it("uses the shared At a glance block and the stocking summary rows", () => {
    expect(patternPage).toContain('slot="print-summary"');
    expect(patternPage).toContain("data-sg-pattern-print-basics-body");
    expect(patternPage).toContain("sg-pattern-print-at-a-glance");
    expect(patternScript).toContain("buildSockPatternSummaryDlHtml(result.view)");

    const cuffDown = buildSockPatternFromDraft(readyDraft("cuff-to-toe"), adapter);
    expect(cuffDown.ok).toBe(true);
    if (!cuffDown.ok) return;
    const printed = buildSockPatternSummaryDlHtml(cuffDown.view);
    expect(printed).toContain('class="print-summary-dl print-summary-dl--basics"');
    expect(printed).toContain("<dt>Pattern</dt><dd>Christmas Stocking</dd>");
    expect(printed).toContain("<dt>Construction</dt><dd>Cuff down</dd>");
    expect(printed).toContain("<dt>Foot and Leg Circumference</dt>");
    expect(printed).not.toContain("<dt>Leg Circumference</dt>");
    expect(printed).not.toContain("print-summary-dl__pair");

    const toeUp = buildSockPatternFromDraft(readyDraft("toe-up"), adapter);
    expect(toeUp.ok).toBe(true);
    if (!toeUp.ok) return;
    expect(buildSockPatternSummaryDlHtml(toeUp.view)).toContain(
      "<dt>Construction</dt><dd>Toe up</dd>",
    );
  });
});
