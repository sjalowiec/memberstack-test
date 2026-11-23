import { describe, expect, it } from "vitest";
import { STOP_ROW_COUNTER_TEXT, RESET_ROW_COUNTER_TEXT } from "../rowCounterReset";
import { sockEnsureCarriageInstruction } from "../sock/sockInstructionRender";
import { buildSockShortRowInstructionSection } from "../sock/sockShortRowInstructions";
import { sockHoldOrientation } from "../sock/sockInstructionModel";
import {
  MITTEN_SECOND_MITTEN_INTRO,
  buildMittenPatternHtml,
  mittenCountSummary,
} from "./mittenInstructions";
import { calculateMittenPattern, womanSmallPreviewCalc, womanSmallPreviewInput } from "./mittenMath";

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

describe("slotted mitten instructions", () => {
  const html = buildMittenPatternHtml(womanSmallPreviewCalc());
  const right = panel(html, "right-edge");
  const left = panel(html, "left-edge");

  it("uses one document for online and print", () => {
    expect(html).toContain('data-print-source="mitten-instructions"');
    expect(html.match(/data-mitten="right-edge"/g)).toHaveLength(1);
    expect(html.match(/data-mitten="left-edge"/g)).toHaveLength(1);
  });

  it("places the carriage side after cast-on setup and before the cuff reset", () => {
    for (const [sideHtml, carriage] of [
      [right, "LEFT"],
      [left, "RIGHT"],
    ] as const) {
      const castOn = block(sideHtml, "cast-on");
      const setup = castOn.indexOf("Complete cast-on setup before the counted cuff rows.");
      const carriageAt = castOn.indexOf(
        `Begin the counted cuff rows with the carriage on the ${carriage}.`,
      );
      const reset = castOn.indexOf(RESET_ROW_COUNTER_TEXT);
      const knit = castOn.indexOf("Knit 26 rows in your choice of cuff pattern.");
      expect(setup).toBeGreaterThanOrEqual(0);
      expect(setup).toBeLessThan(carriageAt);
      expect(carriageAt).toBeLessThan(reset);
      expect(reset).toBeLessThan(knit);
      expect(castOn).toContain("RC: 026");
    }
  });

  it("transfers ribber stitches after the cuff and before the increase", () => {
    const knit = right.indexOf("Knit 26 rows");
    const transfer = right.indexOf("If needed, transfer the ribber stitches to the main bed.");
    const increase = right.indexOf("Increase 4 stitches evenly across the row.");
    expect(knit).toBeLessThan(transfer);
    expect(transfer).toBeLessThan(increase);
    expect(block(right, "increase")).toContain("Leave 1 needle empty at 4 points");
    expect(block(right, "increase")).toContain("picking up the strand from the row below");
    expect(block(right, "increase")).not.toContain(RESET_ROW_COUNTER_TEXT);
  });

  it("keeps the slot rows uncounted and makes the next full-width row row 1 of the straight rows", () => {
    const slot = block(right, "slot");
    const straight = block(right, "straight");
    expect(slot).toContain("outermost needle on the RIGHT");
    expect(slot).toContain("1 row with waste yarn, 1 row with ravel cord, then 1 row with waste yarn");
    expect(slot).toContain("These hand-worked rows do not count on the row counter.");
    expect(slot).not.toContain(RESET_ROW_COUNTER_TEXT);
    expect(straight).toContain(
      "Knit 24 rows across all 50 stitches with the main yarn. Row 1 is the full-width row immediately after the slot.",
    );
    expect(straight.match(/Knit 24 rows/g)).toHaveLength(1);
    expect(straight).toContain("RC: 044");
    expect(right).not.toContain("Continue knitting the hand");
    expect(block(left, "slot")).toContain("outermost needle on the LEFT");
    expect(block(left, "cast-on")).toContain("carriage on the RIGHT");
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
      arriveRc: calc.handEndRc,
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
      thumb.indexOf("Continue knitting the mitten."),
    );
    expect(thumb).toContain("Knit 24 rows.");
    expect(thumb).toContain("RC: 024");
    expect(thumb).toContain("leaving a 12\" tail");
    expect(block(right, "seam")).toContain(
      "Seam from the cast-on edge through the cuff and Hand 1 to the thumb opening.",
    );
    expect(block(right, "seam")).toContain("Seam the thumb edges.");
    expect(block(right, "seam")).toContain(
      "Seam Hand 2 from the thumb opening to the closed fingertips.",
    );
    expect(block(right, "close")).toContain("using Kitchener stitch, by hand or on the machine.");
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
  });

  it("lists calculated lengths separately from the requested measurements", () => {
    const calc = womanSmallPreviewCalc();
    const summary = mittenCountSummary(calc);
    const value = (label: string) => summary.find((line) => line.label === label)?.value;
    expect(value("Calculated cuff length")).toBe("2.6 in");
    expect(value("Calculated Hand 1 length")).toBe("2.0 in");
    expect(value("Calculated Hand 2 length")).toBe("4.1 in");
    expect(value("Calculated mitten length")).toBe("8.7 in");
    expect(value("Fingertip setup row")).toBe("0.1 in");
    expect(value("Straight rows")).toBe("24");
    expect(value("Thumb stitches")).toBe("21");
    expect(calc.measurements.hand2LengthInches).toBe(4);
    expect(calc.measurements.cuffLengthInches).toBe(2.5);
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
    expect(block(right, "markers")).toContain("10 rows apart");
    expect(block(right, "markers")).toContain("half the thumb circumference");
    expect(right).not.toContain("work the");
    expect(right).not.toContain("slot stitches");
  });
});
