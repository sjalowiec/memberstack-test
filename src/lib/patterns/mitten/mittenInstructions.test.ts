import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSingleShortRowShapingMap,
  describeHeelToeDepthAlignment,
  MITTEN_TOP_SHAPING_MAP_TITLE,
} from "../heelToeShapingMap";
import { STOP_ROW_COUNTER_TEXT, RESET_ROW_COUNTER_TEXT } from "../rowCounterReset";
import {
  KITCHENER_STITCH_GLOSSARY_ID,
  KITCHENER_STITCH_GLOSSARY_TERM,
  sockEnsureCarriageInstruction,
} from "../sock/sockInstructionRender";
import { getGlossaryTooltipPayload, glossarySlugForId } from "../../glossary/glossaryTooltipHydrate";
import { buildSockShortRowInstructionSection } from "../sock/sockShortRowInstructions";
import { sockHoldOrientation } from "../sock/sockInstructionModel";
import {
  MITTEN_CUFF_START_CARRIAGE,
  MITTEN_FINGERLESS_MITTS_TIP_ID,
  MITTEN_FINGERLESS_MITTS_TIP_PARAGRAPHS,
  MITTEN_FINGERLESS_MITTS_TIP_TITLE,
  MITTEN_CUFF_OPTIONS_VIDEO_CONTENT_ID,
  MITTEN_INSTRUCTION_SIDES,
  MITTEN_SECOND_MITTEN_INTRO,
  MITTEN_TOP_VIDEO_CONTENT_ID,
  buildMittenPatternHtml,
  mittenLearningVideoRows,
  mittenCountSummary,
  mittenPatternInpageNavItems,
  mittenPatternSectionId,
  type MittenInstructionSide,
} from "./mittenInstructions";
import {
  calculateMittenPattern,
  measurementsFromSizingRow,
  mittenPhysicalLengths,
  womanSmallPreviewCalc,
  womanSmallPreviewInput,
  type MittenCalc,
} from "./mittenMath";
import { MITTEN_SIZING_CHART } from "./mittenSizingChart";

function expectFingerlessMittsTip(html: string, thumbStyle: "slotted" | "gored"): void {
  expect(html).toContain(`data-thumb-style="${thumbStyle}"`);
  expect(html.match(new RegExp(`data-tip-id="${MITTEN_FINGERLESS_MITTS_TIP_ID}"`, "g"))).toHaveLength(2);
  for (const sideId of ["right-edge", "left-edge"] as const) {
    const sideHtml = panel(html, sideId);
    const handStart = sideHtml.indexOf(`id="${mittenPatternSectionId(sideId, "hand-above-the-thumb")}"`);
    const tipAt = sideHtml.indexOf(`data-tip-id="${MITTEN_FINGERLESS_MITTS_TIP_ID}"`);
    const fingertipsAt = sideHtml.indexOf(`id="${mittenPatternSectionId(sideId, "fingertips")}"`);
    const shapingAt = sideHtml.indexOf('data-block="fingertips"');
    const handClose = sideHtml.indexOf("</section>", handStart);
    expect(handClose).toBeGreaterThan(handStart);
    expect(handClose).toBeLessThan(tipAt);
    expect(sideHtml.slice(handStart, handClose)).not.toContain(MITTEN_FINGERLESS_MITTS_TIP_TITLE);
    expect(tipAt).toBeGreaterThanOrEqual(0);
    expect(fingertipsAt).toBeGreaterThan(tipAt);
    expect(shapingAt).toBeGreaterThan(fingertipsAt);
    expect(sideHtml.slice(tipAt, fingertipsAt)).not.toContain("data-block=");
    expect(sideHtml).toContain('class="pattern-tip pattern-quick-tip"');
    expect(sideHtml).toContain("pattern-quick-tip__details");
    expect(sideHtml).toContain("pattern-quick-tip__summary");
    expect(sideHtml).toContain("fa-solid fa-lightbulb");
    expect(sideHtml).toContain("fa-solid fa-chevron-right");
    expect(sideHtml).toContain(`<span class="pattern-quick-tip__label">${MITTEN_FINGERLESS_MITTS_TIP_TITLE}</span>`);
    for (const paragraph of MITTEN_FINGERLESS_MITTS_TIP_PARAGRAPHS) {
      expect(sideHtml).toContain(`<p>${paragraph}</p>`);
    }
    expect(block(sideHtml, "fingertips")).not.toContain(MITTEN_FINGERLESS_MITTS_TIP_TITLE);
    expect(block(sideHtml, "fingertips")).toContain("Before beginning the fingertips");
  }
}

function panel(html: string, id: "right-edge" | "left-edge"): string {
  const start = html.indexOf(`data-mitten="${id}"`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = html.indexOf('data-mitten="', start + 1);
  return html.slice(start, next === -1 ? html.length : next);
}

function block(panelHtml: string, name: string): string {
  const start = panelHtml.indexOf(`data-block="${name}"`);
  expect(start, name).toBeGreaterThanOrEqual(0);
  const next = panelHtml.indexOf("<section", start + 1);
  return panelHtml.slice(start, next === -1 ? panelHtml.length : next);
}

function expectKitchenerClose(panelHtml: string, calc: MittenCalc): void {
  const close = block(panelHtml, "close");
  const link =
    `<span class="glossary-tooltip-placeholder" data-glossary-id="${KITCHENER_STITCH_GLOSSARY_ID}" ` +
    `data-term="Kitchener stitch" data-aria-label="${KITCHENER_STITCH_GLOSSARY_TERM}">Kitchener stitch</span>`;
  expect(KITCHENER_STITCH_GLOSSARY_ID).toBe(521);
  expect(glossarySlugForId(KITCHENER_STITCH_GLOSSARY_ID)).toBe("kitchener-stitch");
  expect(getGlossaryTooltipPayload(KITCHENER_STITCH_GLOSSARY_ID)?.titlePlain).toBe(
    KITCHENER_STITCH_GLOSSARY_TERM,
  );
  expect(close).toContain(
    `Scrap all ${calc.handSts} stitches off the machine with contrasting waste yarn and remove the work from the machine.`,
  );
  expect(close).toContain(
    `Join the ${calc.fingertip.workingStitches} stitches of the shaped half to the ${calc.fingertip.heldStitches} stitches of the other half using ${link}, by hand or on the machine.`,
  );
  expect(close.match(/data-glossary-id="521"/g)).toHaveLength(1);
  expect(close).toContain("by hand or on the machine.");
}

describe("slotted mitten instructions", () => {
  const html = buildMittenPatternHtml(womanSmallPreviewCalc());
  const right = panel(html, "right-edge");
  const left = panel(html, "left-edge");

  it("uses one document for online and print", () => {
    expect(html).toContain('data-print-source="mitten-instructions"');
    expect(html.match(/data-mitten="right-edge"/g)).toHaveLength(1);
    expect(html.match(/data-mitten="left-edge"/g)).toHaveLength(1);
    expect(html).toContain("Hand below the thumb");
    expect(html).toContain("Hand above the thumb");
    expect(html).not.toContain("Hand 1");
    expect(html).not.toContain("Hand 2");
  });

  it("starts the counted cuff rows at RC 000 with the carriage on the right", () => {
    for (const sideHtml of [right, left]) {
      const castOn = block(sideHtml, "cast-on");
      const reset = castOn.indexOf(RESET_ROW_COUNTER_TEXT);
      const carriageAt = castOn.indexOf(MITTEN_CUFF_START_CARRIAGE);
      const knit = castOn.indexOf("Knit 26 rows in your choice of cuff pattern.");
      expect(castOn).not.toContain("Complete cast-on setup before the counted cuff rows.");
      expect(reset).toBeGreaterThanOrEqual(0);
      expect(reset).toBeLessThan(carriageAt);
      expect(carriageAt).toBeLessThan(knit);
      expect(castOn).toContain("RC: 026");
      expect(castOn).not.toContain("carriage on the LEFT");
      expect(castOn).not.toContain("Begin the counted cuff rows with the carriage on the");
    }
  });

  it("transfers ribber stitches after the cuff and before the increase", () => {
    const knit = right.indexOf("Knit 26 rows");
    const transfer = right.indexOf("If needed, transfer the ribber stitches to the main bed.");
    const increase = right.indexOf('data-glossary-id="645"');
    expect(knit).toBeLessThan(transfer);
    expect(transfer).toBeLessThan(increase);
    const calc = womanSmallPreviewCalc();
    for (const sideHtml of [right, left]) {
      const increase = block(sideHtml, "increase");
      expect(increase).toContain("Increase evenly");
      expect(increase).toContain('data-glossary-id="645"');
      expect(increase).toContain(`${calc.increaseSts} stitches across the row.`);
      expect(increase).toContain(
        "Transfer stitches outward to create the required number of empty needles, spaced evenly across the work.",
      );
      expect(increase).toContain(
        "Bring each empty needle into working position and fill it by picking up the strand from the row below.",
      );
      expect(increase).toContain(`(${calc.handSts} stitches)`);
      expect(increase).not.toContain("Leave 1 needle empty");
      expect(increase).not.toContain(RESET_ROW_COUNTER_TEXT);
    }
  });

  it("keeps the slot rows uncounted and resets the counter before the hand above the thumb", () => {
    const slot = block(right, "slot");
    const straight = block(right, "straight");
    const slotAt = right.indexOf('data-block="slot"');
    const resetAt = right.indexOf(RESET_ROW_COUNTER_TEXT, slotAt);
    const knitAt = right.indexOf("Knit 24 rows across all 50 stitches with the main yarn.");
    expect(slot).toContain("outermost needle on the RIGHT");
    expect(slot.match(/data-stitch-marker="inline"/g)).toHaveLength(1);
    expect(slot).toContain('fill="#c62828"');
    expect(slot.indexOf('data-stitch-marker="inline"')).toBeLessThan(
      slot.indexOf("Starting at the outermost needle on the RIGHT"),
    );
    expect(slot).toContain(
      "Starting at the outermost needle on the RIGHT, work the 10 slot stitches by hand: knit 1 row with waste yarn, 1 row with ravel cord, then 1 row with waste yarn.",
    );
    expect(slot).toContain("1 row with waste yarn, 1 row with ravel cord, then 1 row with waste yarn");
    expect(slot).toContain("These hand-worked rows do not count on the row counter.");
    expect(slot).not.toContain(RESET_ROW_COUNTER_TEXT);
    expect(resetAt).toBeGreaterThan(slotAt);
    expect(resetAt).toBeLessThan(knitAt);
    expect(right.slice(slotAt, knitAt)).toContain("RC: 020");
    expect(straight).toContain("Knit 24 rows across all 50 stitches with the main yarn.");
    expect(straight).not.toContain("Row 1 is the full-width row immediately after the slot.");
    expect(straight.match(/Knit 24 rows/g)).toHaveLength(1);
    expect(straight).toContain("RC: 024");
    expect(straight).not.toContain("RC: 044");
    expect(right).not.toContain("Continue knitting the hand");
    expect(block(left, "slot")).toContain("outermost needle on the LEFT");
    expect(block(left, "slot").match(/data-stitch-marker="inline"/g)).toHaveLength(1);
    expect(block(left, "cast-on")).toContain(MITTEN_CUFF_START_CARRIAGE);
  });

  it("follows the shared fingertip steps and keeps the setup row out of the straight count", () => {
    const calc = womanSmallPreviewCalc();
    const shared = buildSockShortRowInstructionSection({
      part: "heel",
      shaping: calc.fingertip,
      orientation: sockHoldOrientation(1, "heel"),
      tubeStitches: calc.handSts,
      constructionDirection: "cuff-to-toe",
      sock: 1,
      arriveRc: calc.straightRows,
    });
    const fingertips = block(right, "fingertips");
    const straight = block(right, "straight");
    expect(right.indexOf('data-block="straight"')).toBeLessThan(right.indexOf('data-block="fingertips"'));
    expect(fingertips.indexOf(STOP_ROW_COUNTER_TEXT)).toBeLessThan(
      fingertips.indexOf("Before beginning the fingertips"),
    );
    expect(fingertips).toContain(
      sockEnsureCarriageInstruction("heel", "right").replace("the heel", "the fingertips"),
    );
    expect(fingertips).toContain("Do not count this setup row on the row counter.");
    expect(fingertips).toContain("RC: 024");
    expect(fingertips).not.toContain("RC: 044");
    expect(fingertips).not.toContain("RC: 032");
    expect(straight).not.toContain("Before beginning the fingertips");
    const stepOrder = [...fingertips.matchAll(/data-step="([^"]+)"/g)].map((match) => match[1]);
    expect(stepOrder).toEqual(
      shared.steps.map((step) => (step.type === "cancel-hold-return" ? "cancel-hold-return" : step.type)),
    );
    expect(block(left, "fingertips")).toContain("carriage on the LEFT");
    expect(block(left, "fingertips")).toContain("Put the RIGHT half");
  });

  it("keeps the approved thumb rehang, seaming, and second-mitten wording", () => {
    const thumb = block(right, "thumb");
    expect(thumb).toContain(
      "Remove the ravel cord and rehang the waste yarn stitches with the wrong side facing. Leave one empty needle in the center, with 10 stitches on each side of it.",
    );
    expect(thumb).toContain("Unknit the waste yarn.");
    expect(thumb.indexOf("Unknit the waste yarn.")).toBeLessThan(
      thumb.indexOf("Pick up two purl bumps from the row below and place both on the center needle. (21 stitches)"),
    );
    expect(thumb.indexOf("place both on the center needle")).toBeLessThan(
      thumb.indexOf("Continue knitting the thumb."),
    );
    for (const sideHtml of [right, left]) {
      const sideThumb = block(sideHtml, "thumb");
      expect(sideThumb).toContain("Continue knitting the thumb.");
      expect(sideThumb).not.toContain("Continue knitting the mitten.");
      expect(sideThumb).toContain("Knit 24 rows.");
      expect(sideThumb).toContain("RC: 024");
      expect(sideThumb).toContain("RESET ROW COUNTER TO 000");
    }
    expect(thumb).toContain("leaving a 12\" tail");
    for (const sideHtml of [right, left]) {
      const seam = block(sideHtml, "seam");
      expect(seam).toContain(
        "Seam from the cast-on edge through the cuff and the hand below the thumb to the thumb opening.",
      );
      expect(seam).toContain("Seam the thumb edges.");
      expect(seam).toContain(
        "Seam the hand above the thumb from the thumb opening to the closed fingertips.",
      );
      expect(seam.indexOf("hand below the thumb")).toBeLessThan(seam.indexOf("Seam the thumb edges."));
      expect(seam.indexOf("Seam the thumb edges.")).toBeLessThan(seam.indexOf("hand above the thumb"));
      expect(seam).toContain("Using mattress stitch or your preferred method:");
      expect(seam).not.toContain("Hand 1");
      expect(seam).not.toContain("Hand 2");
    }
    expectKitchenerClose(right, womanSmallPreviewCalc());
    expectKitchenerClose(left, womanSmallPreviewCalc());
    expect(left).toContain(MITTEN_SECOND_MITTEN_INTRO);
    expect(right).not.toContain(MITTEN_SECOND_MITTEN_INTRO);
  });

  it("puts the slotted-thumb and gathered-top videos on each mitten", () => {
    for (const sideHtml of [right, left]) {
      const slot = block(sideHtml, "slot");
      const thumb = block(sideHtml, "thumb");
      expect(slot).toContain('data-content-id="950"');
      expect(slot).toContain('data-vimeo-id="358494664"');
      expect(slot).toContain("Watch: Slotted Thumbs for Mittens");
      expect(slot).toContain("video-button");
      expect(thumb).toContain('data-content-id="587"');
      expect(thumb).toContain('data-vimeo-id="151859005"');
      expect(thumb).toContain("Watch: Gathered Top for Mittens and Hats");
      expect(thumb.indexOf("Pull the tail firmly")).toBeLessThan(thumb.indexOf('data-content-id="587"'));
    }
  });

  it("leaves the unapproved optional tips out", () => {
    expect(html).not.toContain("steam");
    expect(html).not.toContain("insurance");
    expect(html).not.toContain("single row of ravel cord");
    expect(html).not.toContain("Do not use a single row");
    expect(html).not.toContain("After removing the stitches from the machine");
  });

  it("omits the preview commentary and exposes the shared section anchors", () => {
    expect(html).not.toContain("which face is the palm");
    expect(html).not.toContain("This preview pairs");
    expect(html).not.toContain("mitten-preview-note");
    for (const sideId of ["right-edge", "left-edge"] as const) {
      const sideHtml = sideId === "right-edge" ? right : left;
      for (const item of mittenPatternInpageNavItems(sideId, "slotted")) {
        expect(sideHtml).toContain(`id="${item.ids[0]}"`);
      }
    }
    expect(mittenPatternInpageNavItems("left-edge", "gored").map((item) => item.label)).toEqual([
      "Cuff",
      "Hand",
      "Fingertips",
      "Thumb",
      "Finishing",
    ]);
    expect(mittenPatternInpageNavItems("left-edge", "gored")[3]?.ids).toEqual([
      mittenPatternSectionId("left-edge", "gored-thumb"),
    ]);
  });

  it("uses the sweater instruction blocks, stitch counts, and garment diagrams", () => {
    expect(right).toContain('class="pattern-section');
    expect(right).toContain('class="pattern-section__collapse"');
    expect(right).toContain("Garment Dimensions");
    expect(right).toContain("Stitches &amp; Rows");
    expect(right).toContain("Shaping Notation");
    expect(right).toContain('data-pattern-diagram-panel="sts-rows"');
    expect(right).toContain('data-pattern-diagram-panel="shaping-notation"');
    expect(right).toContain('data-diagram="mitten-sketch"');
    expect(right).toContain('data-diagram="mitten-shaping-notation"');
    expect(right.match(/data-thumb-marker="slot-right"/g)).toHaveLength(2);
    expect(left.match(/data-thumb-marker="slot-left"/g)).toHaveLength(2);
    expect(right).not.toContain("data-armhole-marker-tick");
    expect(left).not.toContain("data-armhole-marker-tick");
    expect(right).not.toContain("Thumb marker");
    expect(right).not.toContain("Place marker");
    expect(right).toContain("co46");
    expect(right).toContain("+4s-1r-1x");
    expect(right).toContain("-1s-1r-16x");
    expect(right).toContain("+1s-1r-16x");
    expect(right).toContain("9 sts");
    expect(block(right, "cast-on")).toContain(">46 sts<");
    expect(block(right, "increase")).toContain(">50 sts<");
    expect(block(right, "hand-1")).toContain(">50 sts<");
    expect(block(right, "straight")).toContain(">50 sts<");
    expect(block(right, "thumb")).toContain(">21 sts<");
    expect(left).toContain('data-slot-edge="left"');
    expect(right).toContain('data-slot-edge="right"');
    expect(right).not.toContain("decrease");
  });

  it("lists calculated lengths separately from the requested measurements", () => {
    const calc = womanSmallPreviewCalc();
    const summary = mittenCountSummary(calc);
    const value = (label: string) => summary.find((line) => line.label === label)?.value;
    expect(value("Calculated cuff length")).toBe("2.6 in");
    expect(value("Calculated hand below the thumb length")).toBe("2.0 in");
    expect(value("Calculated hand above the thumb length")).toBe("4.1 in");
    expect(value("Hand below the thumb rows")).toBe("20");
    expect(summary.some((line) => /Hand [12]/.test(line.label))).toBe(false);
    expect(value("Calculated mitten length")).toBe("8.7 in");
    expect(value("Fingertip setup row")).toBe("0.1 in");
    expect(value("Straight rows")).toBe("24");
    expect(value("Thumb stitches")).toBe("21");
    expect(calc.measurements.hand2LengthInches).toBe(4);
    expect(calc.measurements.cuffLengthInches).toBe(2.5);
  });

  it("places the fingerless mitts Quick Tip immediately before Fingertips on both mittens", () => {
    expectFingerlessMittsTip(html, "slotted");
  });
});

describe("gored thumb instructions", () => {
  const result = calculateMittenPattern({
    ...womanSmallPreviewInput(),
    thumbCircumferenceInches: 2,
    thumbLengthInches: 2,
    thumbStyle: "gored",
  });
  if (!result.ok) throw new Error(result.message);
  const html = buildMittenPatternHtml(result.calc);
  const right = panel(html, "right-edge");
  const left = panel(html, "left-edge");

  it("uses the same gored wording for the screen and the print document", () => {
    expect(html).toContain('data-print-source="mitten-instructions"');
    expect(html).toContain('data-thumb-style="gored"');
    expect(html).not.toContain('data-stitch-marker="inline"');
    expectFingerlessMittsTip(html, "gored");
    const rightThumb = block(right, "thumb");
    const leftThumb = block(left, "thumb");
    expect(leftThumb).toBe(rightThumb);
    expect(rightThumb).toContain("With the wrong side facing, rehang the first edge between the markers on the left needles.");
    expect(rightThumb).toContain("Position the marker nearest the cuff at machine zero.");
    expect(rightThumb).toContain("Rehang 8 stitches from this edge.");
    expect(rightThumb).toContain("Fold the mitten, push the cuff away, and rehang the other edge on the right needles.");
    expect(rightThumb).toContain("Double up on the center needle to prevent a hole. This does not add another needle. (16 needles)");
    expect(rightThumb).toContain("plus 2 seam stitches");
    expect(rightThumb).toContain("Do not pick up one stitch for every row.");
    expect(rightThumb).toContain("Put all needles into hold and set the carriage to HOLD.");
    expect(rightThumb).toContain("Return 4 center needles to working position.");
    expect(rightThumb).toContain("6 needles stay in hold on each side.");
    expect(rightThumb).toContain("Knit across and wrap the first held needle.");
    expect(rightThumb).toContain(
      "Opposite the carriage, return 2 needles to working position. Knit across and wrap the first held needle at that edge if one remains. Repeat, alternating sides, until all needles are working.",
    );
    expect(rightThumb).toContain("When fewer than 2 needles remain in hold at that edge, return only those needles.");
    expect(rightThumb).not.toContain("both sides");
    expect(rightThumb).toContain("Cancel HOLD and knit 20 rows.");
    expect(rightThumb).toContain("these rows do not include the gore short rows");
    expect(rightThumb).toContain("RC: 020");
    expect(rightThumb).toContain("transfer every other stitch to its neighbor and knit one row");
    expect(rightThumb).toContain(
      "Break the yarn, thread the tail through the remaining stitches, gather the tip, and use the tail to seam.",
    );
    expect(rightThumb.toLowerCase()).not.toContain("decrease");
    expect(rightThumb).not.toContain("ravel cord");
    expect(right).toContain("+2s-1r-6x");
    expect(right).toContain('data-diagram="mitten-shaping-notation"');
    expect(left).toContain('data-slot-edge="left"');
    expect(block(right, "hand-1")).toContain("Knit 3 rows. (50 stitches)");
    expect(block(right, "hand-1")).toContain("Place the lower thumb marker on each edge. This marker is nearest the cuff.");
    expect(block(right, "hand-1")).toContain("RC: 003");
    expect(block(right, "hand-1")).not.toContain("Knit 20 rows");
    expect(block(right, "markers")).toContain("Knit 10 rows across all 50 stitches, then place the upper thumb marker on each edge.");
    expect(block(right, "markers")).toContain("10 rows apart");
    expect(block(right, "markers")).toContain("half the thumb circumference");
    expect(block(right, "markers")).toContain("RC: 013");
    expect(block(right, "straight")).toContain("Knit 31 rows across all 50 stitches.");
    expect(block(right, "straight")).toContain("RC: 044");
    expect(block(right, "markers")).not.toContain("Hand 1");
    expect(block(right, "markers")).not.toContain("Hand 2");
    for (const sideHtml of [right, left]) {
      const seam = block(sideHtml, "seam");
      expect(seam).toContain(
        "Seam from the cast-on edge through the cuff and the hand below the thumb to the lower thumb marker.",
      );
      expect(seam).toContain("The gore joins the edges between the markers as those stitches are rehung.");
      expect(seam).toContain("Use the thumb tail to seam the thumb.");
      expect(seam).toContain("Seam from the upper thumb marker to the closed fingertips.");
      expect(seam.indexOf("the hand below the thumb")).toBeLessThan(seam.indexOf("The gore joins"));
      expect(seam.indexOf("The gore joins")).toBeLessThan(seam.indexOf("Use the thumb tail"));
      expect(seam.indexOf("Use the thumb tail")).toBeLessThan(seam.indexOf("upper thumb marker"));
      expect(seam).not.toContain("Hand 1");
      expect(seam).not.toContain("Hand 2");
    }
    expect(html).toContain("Hand below the thumb");
    expect(html).toContain("Hand above the thumb");
    expect(html).not.toContain("Hand 1");
    expect(html).not.toContain("Hand 2");
    expect(right).toContain('id="sg-right-edge-gored-thumb"');
    expect(left).toContain('id="sg-left-edge-gored-thumb"');
    expect(html).not.toContain("which face is the palm");
    expect(right).not.toContain("work the");
    expect(right).not.toContain("slot stitches");
    expectKitchenerClose(right, result.calc);
    expectKitchenerClose(left, result.calc);
  });
});

const SHAPING_MAP_NOTE =
  "Read from the bottom upward. Each grid row is one carriage pass. The row counter remains stopped during fingertip shaping. Numbers on this map show the order of carriage passes, starting at 1. -1 places a needle into hold. +1 returns a needle to work.";

function mapMarkup(panelHtml: string): string {
  const start = panelHtml.indexOf("data-mitten-top-shaping-map");
  expect(start).toBeGreaterThanOrEqual(0);
  const end = panelHtml.indexOf("</svg>", start);
  return panelHtml.slice(start, end + "</svg>".length);
}

function mapAttr(svg: string, name: string): string {
  const match = svg.match(new RegExp(`${name}="([^"]+)"`));
  expect(match, name).toBeTruthy();
  return match?.[1] ?? "";
}

function expectFingertipMap(calc: MittenCalc, side: MittenInstructionSide, panelHtml: string): void {
  const section = buildSockShortRowInstructionSection({
    part: "heel",
    shaping: calc.fingertip,
    orientation: sockHoldOrientation(side.sock, "heel"),
    tubeStitches: calc.handSts,
    constructionDirection: "cuff-to-toe",
    sock: side.sock,
    arriveRc: calc.gore ? calc.handEndRc : calc.straightRows,
  });
  const built = buildSingleShortRowShapingMap(section, {
    title: MITTEN_TOP_SHAPING_MAP_TITLE,
    marker: "mitten-top",
  });
  expect(built.ok).toBe(true);
  if (!built.ok) return;
  const inn = section.steps.find((step) => step.type === "short-row-in");
  const out = section.steps.find((step) => step.type === "short-row-out");
  const place = section.steps.find((step) => step.type === "place-hold");
  const ensure = section.steps.find((step) => step.type === "ensure-carriage");
  if (!inn || inn.type !== "short-row-in" || !out || out.type !== "short-row-out") {
    throw new Error("written short-row steps");
  }
  if (!place || place.type !== "place-hold" || !ensure || ensure.type !== "ensure-carriage") {
    throw new Error("written setup steps");
  }

  const fingertips = block(panelHtml, "fingertips");
  const setupAt = fingertips.indexOf('data-step="ensure-carriage"');
  const mapAt = fingertips.indexOf("data-mitten-top-shaping-map");
  const holdAt = fingertips.indexOf('data-step="place-hold"');
  expect(setupAt).toBeGreaterThanOrEqual(0);
  expect(setupAt).toBeLessThan(mapAt);
  expect(mapAt).toBeLessThan(holdAt);
  const asideAt = panelHtml.indexOf('aria-label="Garment dimensions"');
  expect(panelHtml.indexOf(MITTEN_TOP_SHAPING_MAP_TITLE)).toBeLessThan(asideAt);
  expect(panelHtml.slice(asideAt)).not.toContain("data-mitten-top-shaping-map");

  const stopRc = calc.gore ? calc.handEndRc : calc.straightRows;
  expect(fingertips).toContain(`RC: ${String(stopRc).padStart(3, "0")}`);
  expect(section.rc.startRc).toBe(stopRc);
  expect(built.map.passes[0]?.pass).toBe(1);
  expect(fingertips).toContain(SHAPING_MAP_NOTE);
  expect(fingertips).toContain(STOP_ROW_COUNTER_TEXT);
  expect(fingertips).not.toContain("row counter was reset");
  expect(fingertips).not.toContain("RESET ROW COUNTER");
  expect(fingertips).toContain("pattern-print-keep-charts");
  expect(fingertips).toContain('class="shaping-map__svg shaping-map__svg--heel-toe"');
  expect(fingertips).toContain("shaping-map__scroll");
  expect(fingertips).toContain("Knitting order");
  expect(fingertips).toContain(ensure.side === "right" ? "Carriage right" : "Carriage left");

  const svg = mapMarkup(fingertips);
  expect(mapAttr(svg, "data-grid-columns")).toBe(String(calc.fingertip.workingStitches));
  expect(mapAttr(svg, "data-grid-columns")).not.toBe(String(calc.handSts));
  expect(mapAttr(svg, "data-center-stitches")).toBe(String(inn.remainingStitches));
  expect(mapAttr(svg, "data-working-stitches")).toBe(String(inn.startWorkingStitches));
  expect(mapAttr(svg, "data-hold-passes")).toBe(String(inn.rows));
  expect(mapAttr(svg, "data-return-passes")).toBe(String(out.rows));
  expect(mapAttr(svg, "data-grid-rows")).toBe(String(inn.rows + out.rows));
  expect(mapAttr(svg, "data-carriage-start")).toBe(ensure.side);
  expect(place.workStitches).toBe(built.map.workingStitches);
  expect(place.holdStitches).toBe(calc.fingertip.heldStitches);
  expect(built.map.workingStitches + place.holdStitches).toBe(calc.handSts);
  expect(Math.min(...built.map.passes.map((pass) => pass.inWorkStitches))).toBe(inn.remainingStitches);
  expect(built.map.passes.at(-1)?.inWorkStitches).toBe(out.endWorkingStitches);
  expect(built.map.passes.length).toBe(calc.fingertip.shortRowKnittingRows);
  expect(built.map.passes.length).toBe(calc.fingertip.shortRowDepthRows * 2);
  expect(built.map.passes.length).not.toBe(calc.handEndRc);

  const rendered = [
    ...svg.matchAll(/data-shaping-action="(hold|return)" data-pass="(\d+)" data-side="(left|right)"/g),
  ].map((match) => ({ action: match[1], pass: Number(match[2]), side: match[3] }));
  expect(rendered).toEqual(
    built.map.passes.map((pass) => ({ action: pass.action, pass: pass.pass, side: pass.side })),
  );
  expect(rendered[0]?.side).toBe(ensure.side);
  const holds = rendered.filter((pass) => pass.action === "hold");
  const returns = rendered.filter((pass) => pass.action === "return");
  for (let index = 1; index < holds.length; index += 1) {
    expect(holds[index]?.side).not.toBe(holds[index - 1]?.side);
  }
  for (let index = 1; index < returns.length; index += 1) {
    expect(returns[index]?.side).not.toBe(returns[index - 1]?.side);
  }
  expect(returns[0]?.side).toBe(holds.at(-1)?.side);
  expect(rendered.filter((pass) => pass.action === "hold")).toHaveLength(inn.rows);
  expect(rendered.filter((pass) => pass.action === "return")).toHaveLength(out.rows);
  expect(svg).toContain(`${inn.remainingStitches} center stitches remain`);
  expect(svg).toContain(`${inn.startWorkingStitches} working stitches`);
  expect(svg).not.toContain("RC");
  expect(svg).not.toContain(STOP_ROW_COUNTER_TEXT);
  const numbered = [...svg.matchAll(/class="shaping-map-row-number"[^>]*>(\d+)</g)].map((match) =>
    Number(match[1]),
  );
  expect(numbered[0]).toBe(2);
  expect(numbered.at(-1)).toBe(inn.rows + out.rows);

  const alignment = describeHeelToeDepthAlignment({
    mapPasses: built.map.passes.length,
    holdPasses: inn.rows,
    returnPasses: out.rows,
    instructionInRows: inn.rows,
    instructionOutRows: out.rows,
    depthRows: calc.fingertip.shortRowDepthRows,
    knittingRows: calc.fingertip.shortRowKnittingRows,
    depthInches: mittenPhysicalLengths(calc).fingertipDepthIn,
    rowGaugePerInch: calc.rowGaugePerInch,
  });
  expect(alignment.disagreements).toEqual([]);
  expect(panelHtml).toContain('data-diagram="mitten-sketch"');
  expect(panelHtml).toContain('data-diagram="mitten-shaping-notation"');
}

describe("mitten top shaping map", () => {
  it("places the Woman Small map in the instruction column for both mirrored mittens", () => {
    const calc = womanSmallPreviewCalc();
    const html = buildMittenPatternHtml(calc);
    expect(calc.fingertip.workingStitches).toBe(25);
    expect(calc.fingertip.remainingStitches).toBe(9);
    expect(calc.fingertip.shortRowInSteps).toBe(16);
    expect(calc.fingertip.shortRowOutSteps).toBe(16);
    expect(calc.fingertip.shortRowKnittingRows).toBe(32);
    const sides = MITTEN_INSTRUCTION_SIDES.map((side) => panel(html, side.id));
    expect(sides[0]?.match(/data-mitten-top-shaping-map/g)).toHaveLength(1);
    expect(sides[1]?.match(/data-mitten-top-shaping-map/g)).toHaveLength(1);
    MITTEN_INSTRUCTION_SIDES.forEach((side, index) => {
      expectFingertipMap(calc, side, sides[index] ?? "");
    });
    const rightSides = [...mapMarkup(sides[0] ?? "").matchAll(/data-side="(left|right)"/g)].map(
      (match) => match[1],
    );
    const leftSides = [...mapMarkup(sides[1] ?? "").matchAll(/data-side="(left|right)"/g)].map(
      (match) => match[1],
    );
    expect(mapAttr(mapMarkup(sides[0] ?? ""), "data-carriage-start")).toBe("right");
    expect(mapAttr(mapMarkup(sides[1] ?? ""), "data-carriage-start")).toBe("left");
    expect(leftSides).toEqual(rightSides.map((side) => (side === "right" ? "left" : "right")));
    expect(sides[0]).toContain("-1s-1r-16x");
    expect(sides[0]).toContain("+1s-1r-16x");
  });

  it("uses the same fingertip map for a gored thumb and a different calculated size", () => {
    const woman = calculateMittenPattern({
      ...womanSmallPreviewInput(),
      thumbStyle: "gored",
    });
    expect(woman.ok).toBe(true);
    if (!woman.ok) return;
    const womanHtml = buildMittenPatternHtml(woman.calc);
    expect(womanHtml).toContain('data-thumb-style="gored"');
    for (const side of MITTEN_INSTRUCTION_SIDES) {
      expectFingertipMap(woman.calc, side, panel(womanHtml, side.id));
    }

    const childRow = MITTEN_SIZING_CHART.find((entry) => entry.size === "child_2_4");
    expect(childRow).toBeTruthy();
    if (!childRow) return;
    const child = calculateMittenPattern({
      ...measurementsFromSizingRow(childRow),
      stitchGaugePerInch: 7,
      rowGaugePerInch: 10,
      thumbStyle: "slotted",
    });
    expect(child.ok).toBe(true);
    if (!child.ok) return;
    expect(child.calc.fingertip.workingStitches).not.toBe(woman.calc.fingertip.workingStitches);
    const childHtml = buildMittenPatternHtml(child.calc);
    for (const side of MITTEN_INSTRUCTION_SIDES) {
      expectFingertipMap(child.calc, side, panel(childHtml, side.id));
    }
    const childIncrease = block(panel(childHtml, "right-edge"), "increase");
    expect(childIncrease).toContain(`${child.calc.increaseSts} stitches across the row.`);
    expect(childIncrease).toContain(`(${child.calc.handSts} stitches)`);
    expect(childIncrease).toContain(
      "Transfer stitches outward to create the required number of empty needles, spaced evenly across the work.",
    );
    expect(child.calc.handSts).not.toBe(woman.calc.handSts);
  });

  it("prints with the shared shaping-map rules", () => {
    const page = readFileSync(resolve("src/pages/patterns/mittens/pattern.astro"), "utf8");
    const css = readFileSync(resolve("src/styles/shaping-map.css"), "utf8");
    expect(page).toContain("shaping-map.css");
    expect(page).toContain('import "../../../styles/glossary-tooltip.css"');
    expect(page).toContain('import "../../../styles/print.css"');
    const tooltipPrint = readFileSync(resolve("src/styles/tooltip-print.css"), "utf8");
    expect(tooltipPrint).toMatch(
      /@media print[\s\S]*\.glossary-tooltip-placeholder[\s\S]*display:\s*inline !important;/,
    );
    expect(tooltipPrint).toMatch(/\.glossary-popup[\s\S]*display:\s*none !important;/);
    expect(page).toContain('import "../../../styles/pattern-tips.css"');
    expect(page).toContain('import "../../../styles/pattern-quick-tip.css"');
    expect(page).toContain('id="mitten-pattern-tips-scope"');
    expect(page).toContain('class="pattern-tips-scope"');
    expect(page).toContain('tipsScopeSelector="#mitten-pattern-tips-scope"');
    const tipsCss = readFileSync(resolve("src/styles/pattern-tips.css"), "utf8");
    const quickCss = readFileSync(resolve("src/styles/pattern-quick-tip.css"), "utf8");
    expect(tipsCss).toMatch(/@media print[\s\S]*data-pattern-print-include-tips/);
    expect(quickCss).toMatch(/@media print[\s\S]*\.pattern-quick-tip__body/);
    const builder = readFileSync(resolve("src/pages/patterns/mittens/builder.astro"), "utf8");
    expect(builder).not.toContain("fingerless");
    expect(css).toContain(".shaping-map[data-mitten-top-shaping-map]");
    expect(css).toContain(".shaping-map__scroll");
    expect(css).toMatch(/\.shaping-map\[data-heel-toe-shaping-map\],\s*\.shaping-map\[data-mitten-top-shaping-map\]/);
  });
});

const CUFF_AND_TOP_VIDEOS = [
  {
    content_id: MITTEN_CUFF_OPTIONS_VIDEO_CONTENT_ID,
    title: "Mitten Cuff Options",
    slug: "mitten-cuff-options",
    status: "published",
    vimeo_id: 9009,
    vimeo_hash: "cuffhash1",
  },
  {
    content_id: MITTEN_TOP_VIDEO_CONTENT_ID,
    title: "Mitten Top: Short-Row Shaping",
    slug: "mitten-top-short-row-shaping",
    status: "published",
    vimeo_id: 9008,
  },
] as const;

function expectCuffAndTopVideos(html: string, cuffRows: number): void {
  for (const sideId of ["right-edge", "left-edge"] as const) {
    const sideHtml = panel(html, sideId);
    const cuffStart = sideHtml.indexOf(`id="${mittenPatternSectionId(sideId, "cast-on-and-cuff")}"`);
    const transferStart = sideHtml.indexOf(`id="${mittenPatternSectionId(sideId, "transfer")}"`);
    const cuff = sideHtml.slice(cuffStart, transferStart);
    const cuffSentence = `Knit ${cuffRows} rows in your choice of cuff pattern.`;
    expect(cuff).toContain(`Cast on`);
    expect(cuff).toContain(cuffSentence);
    expect(cuff.indexOf(cuffSentence)).toBeLessThan(cuff.indexOf('data-content-id="5009"'));
    expect(cuff).toContain('data-content-id="5009"');
    expect(cuff).toContain('data-vimeo-id="9009"');
    expect(cuff).toContain('data-vimeo-hash="cuffhash1"');
    expect(cuff).toContain("Watch: Mitten Cuff Options");
    expect(cuff).toContain("video-button");
    expect(cuff).toContain("kbm-kin-catalog-video");
    expect(cuff).toContain("no-print");
    expect(cuff).toContain("data-mitten-cuff-video");

    const fingertipsStart = sideHtml.indexOf(`id="${mittenPatternSectionId(sideId, "fingertips")}"`);
    const closeStart = sideHtml.indexOf(`id="${mittenPatternSectionId(sideId, "close-the-top")}"`);
    const fingertips = sideHtml.slice(fingertipsStart, closeStart);
    const videoAt = fingertips.indexOf('data-content-id="5008"');
    const stepAt = fingertips.indexOf("data-step=");
    expect(videoAt).toBeGreaterThanOrEqual(0);
    expect(stepAt).toBeGreaterThan(videoAt);
    expect(fingertips.indexOf('data-content-id="5008"')).toBeLessThan(
      fingertips.indexOf("Before beginning the fingertips"),
    );
    expect(fingertips).toContain('data-vimeo-id="9008"');
    expect(fingertips).toContain("Watch: Mitten Top: Short-Row Shaping");
    expect(fingertips).toContain("video-button");
    expect(fingertips).toContain("no-print");
    expect(fingertips).toContain("data-mitten-top-video");
  }
}

describe("mitten cuff and fingertip learning videos", () => {
  it("places the catalog videos on slotted and gored mittens without rewriting the instructions", () => {
    const slotted = womanSmallPreviewCalc();
    const slottedHtml = buildMittenPatternHtml(slotted, "in", CUFF_AND_TOP_VIDEOS);
    expectCuffAndTopVideos(slottedHtml, slotted.cuffRows);
    expect(slottedHtml).toContain(MITTEN_CUFF_START_CARRIAGE);

    const gored = calculateMittenPattern({
      ...womanSmallPreviewInput(),
      thumbCircumferenceInches: 2,
      thumbLengthInches: 2,
      thumbStyle: "gored",
    });
    expect(gored.ok).toBe(true);
    if (!gored.ok) return;
    const goredHtml = buildMittenPatternHtml(gored.calc, "in", CUFF_AND_TOP_VIDEOS);
    expectCuffAndTopVideos(goredHtml, gored.calc.cuffRows);
    expect(goredHtml).toContain("With the wrong side facing, rehang the first edge");
  });

  it("omits the buttons when the catalog cannot play those KIN videos", () => {
    const html = buildMittenPatternHtml(womanSmallPreviewCalc());
    expect(html).not.toContain('data-content-id="5008"');
    expect(html).not.toContain('data-content-id="5009"');
    expect(html).toContain('data-content-id="950"');
    expect(html).toContain('data-content-id="587"');
  });

  it("resolves playable catalog rows by KIN id and keeps the player id out of the pattern source", () => {
    expect(
      mittenLearningVideoRows([
        {
          content_id: "5009",
          title: "Mitten Cuff Options",
          status: "published",
          vimeo_id: "4242",
          vimeo_hash: "abc123",
        },
        { content_id: 5008, title: "Mitten Top: Short-Row Shaping", vimeo_id: 88 },
      ]),
    ).toEqual([
      expect.objectContaining({
        content_id: 5009,
        title: "Mitten Cuff Options",
        vimeo_id: 4242,
        vimeo_hash: "abc123",
      }),
      expect.objectContaining({ content_id: 5008, title: "Mitten Top: Short-Row Shaping", vimeo_id: 88 }),
    ]);
    expect(
      mittenLearningVideoRows([
        { content_id: 5008, title: "Mitten Top: Short-Row Shaping", status: "draft", vimeo_id: 11 },
      ]),
    ).toEqual([]);
    expect(mittenLearningVideoRows([{ content_id: 5009, title: "Mitten Cuff Options" }])).toEqual([]);

    const source = readFileSync(resolve("src/lib/patterns/mitten/mittenInstructions.ts"), "utf8");
    expect(source).toContain("MITTEN_CUFF_OPTIONS_VIDEO_CONTENT_ID = 5009");
    expect(source).toContain("MITTEN_TOP_VIDEO_CONTENT_ID = 5008");
    expect(source).not.toContain("9009");
    expect(source).not.toContain("4242");
    expect(source).not.toContain("player.vimeo.com");

    const page = readFileSync(resolve("src/pages/patterns/mittens/pattern.astro"), "utf8");
    expect(page).toContain('id="mitten-pattern-videos"');
    expect(page).toContain("loadMergedVideoCatalog");
    expect(page).toContain("mittenLearningVideoRows");

    const modal = readFileSync(resolve("src/components/common/KinCatalogVideoModal.astro"), "utf8");
    expect(modal).toContain('getAttribute("data-vimeo-hash")');
    const printCss = readFileSync(resolve("src/styles/print.css"), "utf8");
    expect(printCss).toContain(".video-button");
  });
});
