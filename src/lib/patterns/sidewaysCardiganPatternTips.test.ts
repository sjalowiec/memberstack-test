import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSidewaysCardiganBodyInstructions } from "./sidewaysCardiganBodyInstructions";
import type { SidewaysCardiganBodyCalcInput } from "./sidewaysCardiganBodyCalc";
import {
  CAST_ON_RAG_GLOSSARY_ID,
  EWRAP_CAST_ON_GLOSSARY_ID,
  renderSidewaysCardiganBodyDisplayHtml,
} from "./sidewaysCardiganPatternOutput";
import { buildSidewaysCardiganSleeveInstructions, renderSidewaysCardiganSleeveSequenceHtml } from "./sidewaysCardiganSleeveInstructions";
import type { SidewaysCardiganSleeveCalcInput } from "./sidewaysCardiganSleeveCalc";
import { patternTipWrapperHtml } from "./sleevelessPatternOutput";

const BODY: SidewaysCardiganBodyCalcInput = {
  garmentLengthInches: 22,
  vNeckDepthInches: 8,
  finishedBustCircumferenceInches: 40,
  finishedUpperArmInches: 14,
  neckOpeningWidthInches: 7,
  backNeckDepthInches: 1,
  stitchesPerInch: 5,
  rowsPerInch: 7,
};

const SLEEVE: SidewaysCardiganSleeveCalcInput = {
  direction: "cuff-up",
  finishedUpperArmInches: 14,
  finishedWristInches: 7,
  sleeveLengthInches: 17,
  stitchesPerInch: 5,
  rowsPerInch: 7,
  cuffDepthInches: 2,
  armholeDepthInches: 7,
};

function cardiganHtml(): string {
  const result = buildSidewaysCardiganBodyInstructions(BODY, "cardigan");
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return renderSidewaysCardiganBodyDisplayHtml(result.instructions);
}

function sleeveHtml(): string {
  const result = buildSidewaysCardiganSleeveInstructions(SLEEVE);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return renderSidewaysCardiganSleeveSequenceHtml(result.instructions);
}

function instructionLines(html: string): string[] {
  return [...html.matchAll(/<p class="sleeveless-pattern-line">([\s\S]*?)<\/p>/g)].map((match) =>
    match[1] ?? "",
  );
}

describe("Sideways finished-pattern tips", () => {
  it("renders body cast-on help with the shared Quick Tip Lego and glossary links", () => {
    const html = cardiganHtml();
    expect(html).toContain('class="pattern-tip pattern-quick-tip"');
    expect(html).toContain('data-tip-id="sideways-cardigan-cast-on-first-armhole"');
    expect(html).toContain('data-tip-id="sideways-cardigan-cast-on-back-neck"');
    expect(html).toContain("pattern-quick-tip__details");
    expect(html).toContain("pattern-quick-tip__summary");
    expect(html).toContain("fa-solid fa-lightbulb");
    expect(html).toContain("fa-solid fa-chevron-right");
    expect(html).toContain(`data-glossary-id="${EWRAP_CAST_ON_GLOSSARY_ID}"`);
    expect(html).toContain(`data-glossary-id="${CAST_ON_RAG_GLOSSARY_ID}"`);
    expect(html).toContain("cast-on method of your choice");
    expect(instructionLines(html).join("\n")).not.toMatch(/Recommend an|cast-on rag/);
    expect(html).not.toContain("sideways-tip");
    expect(html).not.toContain("<strong>Tip:</strong>");
  });

  it("renders the sleeve cast-on with the same shared tip wrapper", () => {
    const html = sleeveHtml();
    expect(html).toContain('class="pattern-tip pattern-quick-tip"');
    expect(html).toContain("pattern-quick-tip__details");
    expect(html).toContain("Cast-on method");
    expect(html).toContain('data-glossary-id="312"');
    expect(html).not.toContain("sideways-tip");
    const topDown = buildSidewaysCardiganSleeveInstructions({ ...SLEEVE, direction: "top-down" });
    expect(topDown.ok).toBe(true);
    if (!topDown.ok) throw new Error(topDown.error.message);
    const topDownHtml = renderSidewaysCardiganSleeveSequenceHtml(topDown.instructions);
    expect(topDownHtml).toContain('class="pattern-tip pattern-quick-tip"');
    expect(topDownHtml).toContain('data-tip-id="drop-shoulder-cast-on-sleeve-top"');
  });

  it("uses the shared tips page chrome and print rules, not Sideways-only tip CSS", () => {
    const page = readFileSync(
      resolve("src/pages/patterns/sideways-cardigan/pattern/index.astro"),
      "utf8",
    );
    const dropShoulder = readFileSync(
      resolve("src/pages/patterns/drop-shoulder/pattern/index.astro"),
      "utf8",
    );
    expect(page).toContain('import "../../../../styles/pattern-tips.css"');
    expect(page).toContain('import "../../../../styles/pattern-quick-tip.css"');
    expect(page).toContain('import "../../../../styles/pattern-help-card.css"');
    expect(page).toContain('id="sideways-pattern-tips-scope"');
    expect(page).toContain('class="pattern-tips-scope"');
    expect(page).toContain("SavedPatternHeader");
    expect(page).toContain('tipsStorageKey="sleeveless-show-tips"');
    expect(dropShoulder).toContain('tipsStorageKey="sleeveless-show-tips"');
    expect(page).not.toMatch(/\.sideways-tip|\.sideways-pattern-tip/);

    const tipsCss = readFileSync(resolve("src/styles/pattern-tips.css"), "utf8");
    const quickCss = readFileSync(resolve("src/styles/pattern-quick-tip.css"), "utf8");
    expect(tipsCss).toContain(".pattern-tip-dismiss");
    expect(tipsCss).toMatch(/@media print[\s\S]*\.pattern-tip-dismiss/);
    expect(quickCss).toMatch(/@media print[\s\S]*\.pattern-quick-tip__body/);
    expect(patternTipWrapperHtml({
      tipHtml: "<details class=\"pattern-quick-tip__details\"></details>",
      tipHtmlIsFull: true,
      tipPresentation: "quick-tip",
      tipId: "sideways-cardigan-cast-on-first-armhole",
    })).toContain('class="pattern-tip pattern-quick-tip"');
  });
});
