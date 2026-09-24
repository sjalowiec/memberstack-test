import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  dropShoulderSleeveConstructionStorageKey,
  readStoredDropShoulderSleeveConstruction,
  renderSleeveConstructionChoiceHtml,
  writeDropShoulderSleeveConstruction,
} from "./dropShoulderSleeveConstruction";
import {
  buildSidewaysCardiganSleeveShapingNotationSvg,
  buildSidewaysCardiganSleeveStitchesRowsSvg,
} from "./sidewaysCardiganSleeveDiagramSvg";
import {
  buildSidewaysCardiganSleeveInstructions,
  renderSidewaysSleeveSequenceForDirection,
  resolveSidewaysFinishedSleeveDirection,
  type SidewaysCardiganSleeveCalcInput,
} from "./sidewaysCardiganSleeveInstructions";
import { stubLocalStorage } from "./test/stubLocalStorage";

const INPUT: SidewaysCardiganSleeveCalcInput = {
  direction: "cuff-up",
  finishedUpperArmInches: 14,
  finishedWristInches: 7,
  sleeveLengthInches: 17,
  stitchesPerInch: 5,
  rowsPerInch: 7,
  cuffDepthInches: 2,
  armholeDepthInches: 7,
};

function sleeveHtml(direction: "cuff-up" | "top-down") {
  const rendered = renderSidewaysSleeveSequenceForDirection(INPUT, direction);
  expect(rendered.ok).toBe(true);
  if (!rendered.ok) throw new Error(rendered.error.message);
  return rendered;
}

describe("sideways finished sleeve construction choice", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("renders the shared choice block and shared tip inside the SLEEVE section", () => {
    const { html } = sleeveHtml("cuff-up");
    const sleeveAt = html.indexOf(">SLEEVE<");
    const choiceAt = html.indexOf('class="drop-shoulder-sleeve-construction"');
    expect(sleeveAt).toBeGreaterThan(-1);
    expect(choiceAt).toBeGreaterThan(sleeveAt);
    expect(html).toContain('role="group" aria-label="Sleeve construction"');
    expect(html).toContain(">Cuff Up<");
    expect(html).toContain(">Top Down<");
    expect(html).not.toContain(">Bottom-up<");
    expect(html).toContain("pattern-quick-tip");
    expect(html).toContain("drop-shoulder-sleeve-construction-tip-body__columns");
    expect(html).toContain("data-tip-id=\"sideways-sleeve-construction-choice\"");
    expect(html).toContain("Begins at the cuff and increases toward the upper arm.");
    expect(html).toContain("Begins at the upper arm and decreases toward the cuff.");
    expect(html).toContain("Either construction produces the same finished sleeve.");
    expect(html).toContain('class="drop-shoulder-sleeve-construction-wrap no-print"');
  });

  it("keeps Drop Shoulder labels on the shared renderer", () => {
    const html = renderSleeveConstructionChoiceHtml({ direction: "cuff-up" });
    expect(html).toContain(">Bottom-up<");
    expect(html).toContain(">Top-down<");
    expect(html).toContain('data-tip-id="drop-shoulder-sleeve-construction-choice"');
  });

  it("selects the builder direction until the finished pattern stores a choice", () => {
    expect(readStoredDropShoulderSleeveConstruction("pattern-sideways")).toBeNull();
    expect(resolveSidewaysFinishedSleeveDirection("top-down", "pattern-sideways")).toBe("top-down");
    expect(resolveSidewaysFinishedSleeveDirection("cuff-up", "pattern-sideways")).toBe("cuff-up");
    const cuff = sleeveHtml("cuff-up").html;
    expect(cuff).toContain('data-drop-shoulder-sleeve-construction="cuff-up" aria-pressed="true"');
    expect(cuff).toContain('data-drop-shoulder-sleeve-construction="top-down" aria-pressed="false"');
    const top = sleeveHtml("top-down").html;
    expect(top).toContain('data-drop-shoulder-sleeve-construction="top-down" aria-pressed="true"');
  });

  it("persists the finished-pattern choice with the Drop Shoulder storage key", () => {
    writeDropShoulderSleeveConstruction("pattern-sideways", "top-down");
    expect(localStorage.getItem(dropShoulderSleeveConstructionStorageKey("pattern-sideways"))).toBe(
      "top-down",
    );
    expect(resolveSidewaysFinishedSleeveDirection("cuff-up", "pattern-sideways")).toBe("top-down");
    expect(resolveSidewaysFinishedSleeveDirection("sideways", "pattern-sideways")).toBe("sideways");
  });

  it("switches sleeve instructions and both sleeve diagrams without changing the body", () => {
    const cuff = sleeveHtml("cuff-up");
    const top = sleeveHtml("top-down");
    expect(cuff.html).toContain("Increase 1 stitch at each side");
    expect(cuff.html).not.toContain("Decrease 1 stitch at each side");
    expect(top.html).toContain("Decrease 1 stitch at each side");
    expect(top.html).not.toContain("Increase 1 stitch at each side");
    expect(cuff.instructions.direction).toBe("cuff-up");
    expect(top.instructions.direction).toBe("top-down");

    const diagramArgs = (direction: "cuff-up" | "top-down") => {
      const built = buildSidewaysCardiganSleeveInstructions({ ...INPUT, direction });
      if (!built.ok) throw new Error(built.error.message);
      return {
        calc: built.instructions.calc,
        stitchesPerInch: INPUT.stitchesPerInch,
        rowsPerInch: INPUT.rowsPerInch,
      };
    };
    const cuffSts = buildSidewaysCardiganSleeveStitchesRowsSvg(diagramArgs("cuff-up"));
    const topSts = buildSidewaysCardiganSleeveStitchesRowsSvg(diagramArgs("top-down"));
    const cuffNotation = buildSidewaysCardiganSleeveShapingNotationSvg(diagramArgs("cuff-up"));
    const topNotation = buildSidewaysCardiganSleeveShapingNotationSvg(diagramArgs("top-down"));
    expect(cuffSts).toContain('data-knit-direction="up"');
    expect(topSts).toContain('data-sleeve-frame="top-down"');
    expect(Number(topSts?.match(/data-wrist-y="([^"]+)"/)?.[1])).toBeLessThan(
      Number(topSts?.match(/data-upper-arm-y="([^"]+)"/)?.[1]),
    );
    expect(cuffSts).toContain('data-sleeve-frame="cuff-up"');
    expect(cuffNotation).toContain('data-knit-edge="start"');
    expect(cuffNotation).not.toContain("Increase both edges");
    expect(topNotation).not.toContain("Decrease both edges");
    expect(cuffNotation).not.toBe(topNotation);
    expect(cuff.html).not.toContain("data-sideways-diagram-tabs-mount");
    expect(top.html).not.toContain("data-sideways-diagram-tabs-mount");
    expect(cuff.html).not.toContain('id="sg-body"');
    expect(top.html).toContain('id="sg-sleeve"');
  });

  it("prints only the selected sleeve direction", () => {
    const cuffRendered = sleeveHtml("cuff-up");
    const topRendered = sleeveHtml("top-down");
    const cuff = cuffRendered.html;
    const top = topRendered.html;
    const cuffRows = cuffRendered.instructions.calc.cuffRows;
    expect(cuff).toContain('class="drop-shoulder-sleeve-construction-wrap no-print"');
    expect(top).toContain('class="drop-shoulder-sleeve-construction-wrap no-print"');
    const cuffInstructions = cuff.slice(cuff.indexOf('id="sg-sleeve"'));
    const topInstructions = top.slice(top.indexOf('id="sg-sleeve"'));
    expect(cuffInstructions).toContain("Increase 1 stitch at each side");
    expect(cuffInstructions).not.toContain("Decrease 1 stitch at each side");
    expect(topInstructions).toContain("Decrease 1 stitch at each side");
    expect(topInstructions).not.toContain("Increase 1 stitch at each side");
    expect(cuffInstructions).not.toContain("Choose the method that is most comfortable.");
    expect(cuffInstructions).toContain("Either construction produces the same finished sleeve.");
    expect(cuffInstructions).toContain(
      `Knit ${cuffRows} rows of ribbing, transfer the stitches to the main bed`,
    );
    expect(cuffInstructions).toContain("instead of knitting them plain");
    expect(cuffInstructions).not.toContain("transfer the stitches to the ribber");
    expect(topInstructions).toContain(
      `Knit ${topRendered.instructions.calc.cuffRows} rows of ribbing, then`,
    );
    expect(topInstructions).toContain("Transfer the stitches to the ribber in the needle arrangement of your choice.");
    expect(topInstructions).not.toContain("cast on in the ribbing needle arrangement");
    expect(cuffInstructions).toContain("Knit");
    expect(cuffInstructions.indexOf("For a ribbed cuff")).toBeLessThan(cuffInstructions.indexOf("SLEEVE BODY"));
    expect(topInstructions.indexOf("SLEEVE BODY")).toBeLessThan(topInstructions.indexOf("For a ribbed cuff"));
    expect(cuff.indexOf(">Cuff Up<")).toBeLessThan(cuff.indexOf("Increase 1 stitch at each side"));
    expect(cuff.indexOf("no-print")).toBeLessThan(cuff.indexOf(">Cuff Up<"));
  });

  it("uses the calculated cuff rows for ribbing and does not add sleeve length", () => {
    const depths = [1.5, 3];
    const cuffCounts: number[] = [];
    for (const cuffDepthInches of depths) {
      for (const direction of ["cuff-up", "top-down"] as const) {
        const rendered = renderSidewaysSleeveSequenceForDirection(
          { ...INPUT, cuffDepthInches, direction },
          direction,
        );
        expect(rendered.ok).toBe(true);
        if (!rendered.ok) throw new Error(rendered.error.message);
        const { calc } = rendered.instructions;
        cuffCounts.push(calc.cuffRows);
        expect(calc.sleeveTotalRows).toBe(calc.sleeveBodyRows + calc.cuffRows);
        expect(rendered.html).toContain(`Knit ${calc.cuffRows} rows even.`);
        expect(rendered.html).toContain(`Knit ${calc.cuffRows} rows of ribbing`);
        expect(rendered.html).toContain("instead of knitting them plain");
        expect(rendered.html).not.toContain(`Knit ${calc.cuffRows + calc.sleeveBodyRows} rows of ribbing`);
        if (direction === "cuff-up") {
          expect(rendered.html).toContain("transfer the stitches to the main bed, then continue with the sleeve.");
          expect(rendered.html).not.toContain("transfer the stitches to the ribber");
          expect(rendered.html).toContain(`RC: ${String(calc.sleeveTotalRows).padStart(3, "0")}`);
        } else {
          expect(rendered.html).toContain("Transfer the stitches to the ribber in the needle arrangement of your choice.");
          expect(rendered.html).not.toContain("cast on in the ribbing needle arrangement");
          expect(rendered.html).toContain(`RC: ${String(calc.sleeveBodyRows).padStart(3, "0")}`);
        }
      }
    }
    expect(new Set(cuffCounts).size).toBeGreaterThan(1);
  });

  it("places sleeve instructions before the diagram in reading order", () => {
    const { html } = sleeveHtml("cuff-up");
    const instructionsAt = html.indexOf("sideways-sleeve-reading-layout__instructions");
    const diagramAt = html.indexOf("data-sideways-sleeve-diagram-tabs-mount");
    expect(instructionsAt).toBeGreaterThan(-1);
    expect(diagramAt).toBeGreaterThan(instructionsAt);
    expect(html).toContain("sleeveless-pattern-reading-layout");
    expect(html).toContain("pattern-layout__content");
    expect(html).toContain("pattern-layout__sidebar");
    const page = readFileSync("src/pages/patterns/sideways-cardigan/pattern/index.astro", "utf8");
    expect(page).not.toContain("sideways-sleeve-reading-layout__instructions");
    const css = readFileSync("src/styles/patterns/sleeveless-pattern-shared.css", "utf8");
    expect(css).toContain("grid-template-columns: minmax(0, 62fr) minmax(0, 38fr)");
    expect(css).toContain("position: sticky");
    expect(css).toContain("@media (min-width: 1100px)");
  });

  it("uses native buttons and the shared construction styles for keyboard and mobile", () => {
    const { html } = sleeveHtml("cuff-up");
    expect(html).toContain('type="button" class="sleeveless-back-diagram-mode__btn is-active"');
    expect(html).toContain('type="button" class="sleeveless-back-diagram-mode__btn"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
    const css = readFileSync(
      resolve("src/styles/patterns/sleeveless-pattern-shared.css"),
      "utf8",
    );
    expect(css).toContain("#pattern-content .drop-shoulder-sleeve-construction");
    expect(css).toContain("@media (min-width: 520px)");
    const page = readFileSync("src/scripts/sideways-cardigan-pattern-page.ts", "utf8");
    const handler = page.slice(page.indexOf("function bindSidewaysSleeveConstructionChoice"));
    const handlerBody = handler.slice(0, handler.indexOf("function renderView"));
    expect(handlerBody).toContain("sleeveEl.innerHTML = rendered.html");
    expect(handlerBody).toContain("fillSidewaysSleeveDiagrams(nextView, sleeveEl)");
    expect(handlerBody).toContain("closeSleevelessDiagramModal()");
    expect(handlerBody).not.toContain("sequenceEl");
    expect(handlerBody).not.toContain("fillSidewaysPatternDiagrams");
  });
});
