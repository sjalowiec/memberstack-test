import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AVAILABLE_NEEDLES_REQUIRED_MESSAGE } from "../patterns/sleevelessExpressAvailableNeedles";
import {
  CIRCLE_CM_PER_INCH,
  buildCircleCalculator,
  circleDiagramContent,
  circleInstructionsHtml,
  circleNeedleLimitMessage,
  circleRequiredNeedles,
  circleCircumferenceInches,
  circleCircumferenceText,
  formatApproximateCircleLength,
  formatCircleLength,
  taperRowNumbers,
  type CircleCalculatorInput,
  type CirclePlan,
} from "./circleCalculator";
import { circleWedgeDiagramSvg } from "./circleCalculatorDiagram";

function reviewedSample(overrides: Partial<CircleCalculatorInput> = {}): CircleCalculatorInput {
  return {
    construction: "wedges",
    direction: "decrease",
    wedges: 8,
    stitches: 7,
    rows: 10,
    gaugeSpanInches: 1,
    diameter: 20,
    unit: "in",
    availableNeedles: 200,
    ...overrides,
  };
}

function wedgePlan(input: CircleCalculatorInput) {
  const result = buildCircleCalculator(input);
  expect(result.ok).toBe(true);
  if (!result.ok || result.plan.kind !== "wedges") throw new Error("expected a wedge plan");
  return result;
}

describe("reviewed 8-wedge sample", () => {
  it("reproduces the decrease schedule from 7 stitches and 10 rows per inch", () => {
    const result = wedgePlan(reviewedSample());
    const plan = result.plan;
    if (plan.kind !== "wedges") return;
    const half = Math.PI / 8;
    const flatChordStitches = 20 * Math.tan(half) * 7;
    const cornerChordStitches = 20 * Math.sin(half) * 7;
    expect(plan.outerBodyStitches).toBe(57);
    expect(plan.outerNeedleStitches).toBe(59);
    expect(Math.abs(flatChordStitches - 57)).toBeLessThan(Math.abs(flatChordStitches - 59));
    expect(plan.outerBodyStitches).not.toBe(53);
    expect(Math.abs(cornerChordStitches - 53)).toBeLessThan(1);
    const geometricHeight = (57 - 1) / 7 / 2 / Math.tan(half);
    expect(plan.geometricRows).toBe(Math.round(geometricHeight * 10));
    expect(plan.totalRows).toBe(Math.max(plan.geometricRows, (59 - 3) / 2 + 1));
    expect(plan.taperRows.map((row) => row.row).slice(0, -1)).toEqual(
      taperRowNumbers((59 - 3) / 2, plan.totalRows - 1),
    );
    expect(plan.taperRows.map((row) => row.stitchesOnNeedle).slice(0, -1)).toEqual(
      taperRowNumbers((59 - 3) / 2, plan.totalRows - 1).map((_, index) => 59 - 2 * (index + 1)),
    );
    expect(plan.taperRows.at(-1)).toEqual({ row: plan.totalRows, stitchesOnNeedle: 1 });
    expect(plan.finishedAcrossFlatsInches).toBeCloseTo((2 * plan.lengthInches * (57 / 7)) / (56 / 7), 5);
    expect(plan.finishedAcrossFlatsInches).toBeGreaterThan(2 * plan.lengthInches);
    expect(taperRowNumbers(26, 89)[12]).toBe(44);
    expect(result.patternHtml).toContain(
      "Seaming stitches are on the needles and are not included in the finished widths.",
    );
    expect(result.patternHtml).toContain(
      "Work decreases at least 1 stitch in from the edge for easier seaming.",
    );
    expect(result.patternHtml).not.toContain("Work increases at least 1 stitch");
    expect(result.patternHtml).not.toContain("/videos/811");
    expect(result.patternHtml).not.toContain("left out of the finished widths");
    expect(result.patternHtml).not.toContain("At the wide end");
    expect(result.patternHtml).not.toContain("At the narrow end");
    expect(result.patternHtml).not.toContain("circle-measures");
    expect(result.patternHtml).not.toContain("Opposite outer corners");
    expect(result.patternHtml.indexOf("Knit 7 more wedges.")).toBeGreaterThan(
      result.patternHtml.indexOf("Break the yarn and pull the tail through the last stitch."),
    );
    expect(result.patternHtml.indexOf("Finishing")).toBeGreaterThan(result.patternHtml.indexOf("Knit 7 more wedges."));
    expect(result.patternHtml).toContain("Break the yarn and pull the tail through the last stitch.");
    expect(result.patternHtml).toContain("<h3>Knit 8 wedges</h3>");
    expect(result.patternHtml).not.toContain("Knit 8 wedges.");
    expect(result.patternHtml).toContain("Knit until the row counter shows the listed number, shape, then continue knitting.");
    expect(result.patternHtml).not.toContain("carriage on either side");
    expect(result.patternHtml).not.toContain("Thread a darning needle");
    expect(result.patternHtml).toContain('<th scope="col">Row counter</th>');
    expect(result.patternHtml).toContain('<th scope="col">Stitches</th>');
    expect(result.patternHtml).not.toContain("Stitches on the needle after the shaping");
    expect(result.patternHtml).toContain('class="circle-checklist-card"');
    expect(result.patternHtml.match(/class="circle-checklist__box/g)).toHaveLength(plan.taperRows.length);
    expect(result.patternHtml).toContain(
      '<div class="circle-checklist-block"><div class="circle-checklist-actions no-print"><button type="button" class="circle-checklist-clear" data-checklist-clear disabled>Clear checkmarks</button></div><div class="circle-checklist-card">',
    );
    expect(result.patternHtml).toContain('aria-label="Mark row counter 3 done"');
    expect(result.patternHtml).toContain(
      "If you plan to join the seams with Bickford seams, be aware that the pattern includes seaming stitches.",
    );
    expect(result.patternHtml).toContain(
      '<a href="/glossary/mattress-stitch/" class="glossary-link">mattress stitch</a>',
    );
    expect(result.patternHtml).toContain(
      '<a href="/glossary/sew-as-you-go/" class="glossary-link">sew-as-you-go</a>',
    );
    expect(result.patternHtml).toContain(
      '<a href="/glossary/bickford-seam/" class="glossary-link">Bickford seam</a>',
    );
    expect(result.patternHtml).not.toMatch(/<a (?![^>]*class="glossary-link")[^>]*href="\/glossary\//);
    const pointAngle = plan.pointAngleDegrees.toFixed(2);
    expect(result.patternHtml).not.toContain(pointAngle);
    expect(result.reviewNotes.join(" ")).toContain(`Point angle ${pointAngle}`);
    expect(result.reviewNotes.join(" ")).toContain("wedges come to");
    expect(result.diagram.diameterLabel).toBe(formatCircleLength(plan.finishedAcrossFlatsInches, "in"));
    expect(plan.outerEdgeInches).toBeCloseTo(57 / 7, 5);
    expect(plan.lengthInches).toBeCloseTo(plan.totalRows / 10, 5);
    expect(plan.sideSeamInches).toBeGreaterThan(plan.lengthInches);
  });

  it("reproduces the increase ending and the same taper", () => {
    const result = wedgePlan(reviewedSample({ direction: "increase" }));
    const plan = result.plan;
    if (plan.kind !== "wedges") return;
    expect(plan.taperRows.map((row) => row.stitchesOnNeedle)).toEqual(
      taperRowNumbers((plan.outerNeedleStitches - 3) / 2, plan.totalRows - 1).map((_, index) => 5 + index * 2),
    );
    expect(result.patternHtml).toContain(
      `After the increase at RC ${plan.totalRows - 1}, knit 1 row across all ${plan.outerNeedleStitches} stitches (RC ${plan.totalRows}). Bind off.`,
    );
    expect(result.patternHtml).toContain("Scrap on 3 stitches with waste yarn");
    expect(result.patternHtml).toContain("Hang a suitable weight.");
    expect(result.patternHtml).toContain(
      "Thread a darning needle through the 3 starting stitches before removing the waste yarn. After joining the wedges, draw these stitches together to close the center and fasten securely.",
    );
    expect(result.patternHtml).not.toContain("yarn needle");
    expect(result.patternHtml.match(/class="circle-checklist__box/g)).toHaveLength(plan.taperRows.length);
    expect(result.patternHtml).toContain('<th scope="col">Stitches</th>');
    expect(result.patternHtml).not.toContain("For each wedge, remove the waste yarn");
    expect(result.patternHtml).not.toMatch(/remove the weight/i);
    expect(result.patternHtml).not.toContain("Knit 8 wedges.");
    expect(result.patternHtml).not.toContain("carriage on either side");
    expect(result.patternHtml).toContain(
      "Work increases at least 1 stitch in from the edge for easier seaming.",
    );
    expect(result.patternHtml).not.toContain("Work decreases at least 1 stitch");
    expect(result.patternHtml.indexOf("Knit 7 more wedges.")).toBeGreaterThan(result.patternHtml.indexOf("Bind off."));
    expect(result.patternHtml.indexOf("Finishing")).toBeGreaterThan(result.patternHtml.indexOf("Knit 7 more wedges."));
    expect(result.patternHtml).not.toContain("Break the yarn and pull the tail through the last stitch.");
  });

  it("matches when the same gauge is entered over 4 inches", () => {
    const perInch = wedgePlan(reviewedSample());
    const overFour = wedgePlan(reviewedSample({ stitches: 28, rows: 40, gaugeSpanInches: 4 }));
    expect(overFour.plan).toMatchObject({
      outerBodyStitches: 57,
      outerNeedleStitches: 59,
      totalRows: perInch.plan.kind === "wedges" ? perInch.plan.totalRows : 0,
    });
    if (perInch.plan.kind === "wedges" && overFour.plan.kind === "wedges") {
      expect(overFour.plan.taperRows).toEqual(perInch.plan.taperRows);
    }
  });

  it("matches an equivalent centimeter entry", () => {
    const span = 10 / CIRCLE_CM_PER_INCH;
    const inches = wedgePlan(reviewedSample({ stitches: 28, rows: 40, gaugeSpanInches: 4 }));
    const centimeters = wedgePlan(
      reviewedSample({
        stitches: 7 * span,
        rows: 10 * span,
        gaugeSpanInches: span,
        diameter: 20 * CIRCLE_CM_PER_INCH,
        unit: "cm",
      }),
    );
    if (inches.plan.kind !== "wedges" || centimeters.plan.kind !== "wedges") return;
    expect(centimeters.plan.taperRows).toEqual(inches.plan.taperRows);
    expect(centimeters.plan.outerBodyStitches).toBe(57);
    expect(centimeters.plan.totalRows).toBe(inches.plan.totalRows);
    expect(centimeters.diagram.diameterLabel).toBe(formatCircleLength(inches.plan.finishedAcrossFlatsInches, "cm"));
  });
});

describe("6-wedge circle", () => {
  it("uses its own odd outer count and still shapes one stitch at each edge", () => {
    const result = wedgePlan(reviewedSample({ wedges: 6 }));
    const plan = result.plan;
    if (plan.kind !== "wedges") return;
    const flatStitches = 20 * Math.tan(Math.PI / 6) * 7;
    expect(plan.outerBodyStitches).toBe(81);
    expect(Math.abs(flatStitches - 81)).toBeLessThan(Math.abs(flatStitches - 79));
    expect(plan.outerBodyStitches % 2).toBe(1);
    expect(plan.outerNeedleStitches).toBe(83);
    expect(plan.taperRows[0]?.stitchesOnNeedle).toBe(81);
    expect(plan.taperRows.at(-2)?.stitchesOnNeedle).toBe(3);
    expect(plan.taperRows.at(-1)).toEqual({ row: plan.totalRows, stitchesOnNeedle: 1 });
    expect(plan.outerStitchTie).toBe(false);
    expect(result.patternHtml).not.toContain("equally close");
    const tie = wedgePlan(reviewedSample({ wedges: 6, diameter: 10 * Math.sqrt(3) }));
    expect(tie.plan.kind === "wedges" && tie.plan.outerStitchTie).toBe(true);
    expect(tie.plan.kind === "wedges" && tie.plan.outerBodyStitches).toBe(71);
    expect(tie.reviewNotes.join(" ")).toContain("equally close to 69 and 71");
    expect(tie.patternHtml).not.toContain("equally close");
    expect(result.patternHtml).toContain("Knit 5 more wedges.");
    expect(result.patternHtml).not.toContain("Knit 7 more wedges.");
    const increase = wedgePlan(reviewedSample({ wedges: 6, direction: "increase" }));
    expect(increase.patternHtml).toContain("Knit 5 more wedges.");
    expect(increase.patternHtml.indexOf("Finishing")).toBeGreaterThan(increase.patternHtml.indexOf("Knit 5 more wedges."));
    expect(result.diagram.diameterLabel).not.toBe(formatCircleLength(
      wedgePlan(reviewedSample()).plan.finishedAcrossFlatsInches,
      "in",
    ));
  });
});

describe("flat short row", () => {
  it("casts on from the center to a corner and makes each section's outside edge one straight side", () => {
    const result = buildCircleCalculator(reviewedSample({ construction: "short-row", wedges: 8 }));
    expect(result.ok).toBe(true);
    if (!result.ok || result.plan.kind !== "short-row") return;
    const castOn = Math.round((10 / Math.cos(Math.PI / 8)) * 7);
    expect(castOn).toBe(76);
    expect(castOn).not.toBe(70);
    expect(result.plan.castOn).toBe(castOn);
    expect(result.plan.cornerRadiusInches).toBeCloseTo(76 / 7, 10);
    const sideRows = 2 * (76 / 7) * Math.sin(Math.PI / 8) * 10;
    expect(sideRows).toBeCloseTo(83.1, 1);
    expect(result.plan.rowsPerWedge).toBe(84);
    expect(result.plan.rowsPerWedge % 2).toBe(0);
    expect(result.plan.sideInches).toBeCloseTo(8.4, 10);
    expect(result.plan.finishedAcrossCornersInches).toBeCloseTo(152 / 7, 10);
    expect(result.plan.finishedAcrossFlatsInches).toBeCloseTo(2 * Math.sqrt((76 / 7) ** 2 - 4.2 ** 2), 10);
    expect(result.plan.angleSumDegrees).toBeCloseTo((16 * Math.asin(4.2 / (76 / 7)) * 180) / Math.PI, 10);
    const six = buildCircleCalculator(reviewedSample({ construction: "short-row", wedges: 6 }));
    expect(six.ok && six.plan.kind === "short-row" && six.plan.castOn).toBe(81);
    expect(six.ok && six.plan.kind === "short-row" && six.plan.rowsPerWedge).toBe(116);
    expect(result.plan.rowsPerWedge).toBe(result.plan.steps.length * 2);
    expect(result.plan.steps[0]?.returnNeedles).toBeGreaterThan(0);
    expect(result.plan.steps.at(-1)?.needlesWorking).toBe(castOn);
    expect(result.patternHtml).toContain(`Scrap on</a> ${castOn} stitches with waste yarn.`);
    expect(result.patternHtml).toContain("Work 8 short-row sections");
    expect(result.patternHtml).not.toContain("Knit 8 wedges");
    expect(result.patternHtml).not.toContain("opposite outer points");
    expect(result.patternHtml).not.toContain(formatCircleLength(result.plan.finishedAcrossFlatsInches, "in"));
    expect(result.patternHtml).toContain('href="/videos/811"');
    expect(result.patternHtml).toContain("Short-row refresher");
    expect(result.patternHtml).toContain('class="pattern-video-modal-link no-print"');
    expect(result.patternHtml).toContain(`The last 2 rows are knitted across all ${castOn} stitches.`);
    expect(result.patternHtml).toContain('class="circle-checklist-card"');
    expect(result.patternHtml.match(/class="circle-checklist__box/g)).toHaveLength(result.plan.steps.length);
    expect(result.patternHtml.match(/data-checklist-clear disabled>Clear checkmarks</g)).toHaveLength(1);
    expect(result.patternHtml).toContain(
      '<th scope="col" class="circle-checklist__check" aria-label="Done"></th><th scope="col">Needles returned</th><th scope="col">Row counter</th><th scope="col">Needles in work</th></tr>',
    );
    expect(result.patternHtml).not.toContain(">Step<");
    expect(result.patternHtml).not.toContain("Row counter after those rows");
    expect(result.patternHtml.match(/Knit across, wrap manually, and knit back\./g)).toHaveLength(2);
    const first = result.plan.steps[0]!;
    expect(result.patternHtml).toContain(
      `<td>${first.returnNeedles}</td><td>${first.rowCounterAfter}</td><td>${first.needlesWorking}</td></tr>`,
    );
    expect(result.patternHtml).toContain(`aria-label="Mark row counter ${first.rowCounterAfter} done"`);
    expect(result.patternHtml).not.toContain("Bickford");
    expect(result.patternHtml).not.toContain("Break the yarn");
    expect(result.patternHtml).not.toContain("outer edge");
    expect(result.reviewNotes).toContain("How to close the center.");
    expect(result.reviewNotes[1]).toBe(
      "Awaiting a knitted sample. The octagon shape and finished size are calculated from the gauge. Only a knitted and measured sample can confirm them.",
    );
    expect(result.reviewNotes).toContain("Cast-on, center to a corner: 76 stitches, 10.86 inches.");
    expect(result.reviewNotes).toContain("Outside edge of each section, one straight side: 84 rows, 8.40 inches.");
    expect(result.reviewNotes).toContain(
      "Outside edge in total: 673 rows, including 1 setup row. No grafting allowance is added.",
    );
    expect(result.reviewNotes.join(" ")).not.toMatch(/flat circle|radius/i);
    expect(result.reviewNotes).not.toContain("The fabric has not been tested by knitting this result.");
    for (const settled of [
      "Which cast-on method to use.",
      "How to join the cast-on edge to the final edge.",
      "Which end the carriage starts on.",
    ]) {
      expect(result.reviewNotes).not.toContain(settled);
    }
  });

  it("uses the confirmed scrap-on, wrapping, scrap-off and Kitchener method", () => {
    const result = buildCircleCalculator(reviewedSample({ construction: "short-row", wedges: 8 }));
    if (!result.ok || result.plan.kind !== "short-row") throw new Error("expected a short-row plan");
    const html = result.patternHtml;
    const text = html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
    const order = [
      "Scrap on 76 stitches with waste yarn.",
      "Change to the main yarn and knit 1 row.",
      "Set the row counter to 000.",
      "Set the carriage to hold and push all 76 needles into hold position.",
      "Return the first group, 1 needle, to work next to the carriage. This is the first row of the chart.",
      "Knit across, wrap manually, and knit back.",
      "Return the next group of needles to work beside the needles already working.",
      "Knit across, wrap manually, and knit back.",
      "Continue following the chart until all 76 needles are back in work.",
      "The chart lists the needles to return at each of the 42 steps.",
      "Wrap manually to prevent holes, as shown in the Short-row refresher video.",
      "The last 2 rows are knitted across all 76 stitches. The row counter shows 84.",
      "For each remaining section, set the row counter to 000, set the carriage to hold, push all 76 needles into hold position, and repeat the short-row sequence. Knit the 1 main-yarn row only once, at the start of the piece. Continue until 8 sections are complete.",
      "After completing all 8 sections, scrap off with waste yarn. Do not bind off the main-yarn stitches.",
      "Graft the starting and finishing live edges together with the Kitchener join to form the circle's single seam. Remove the waste yarn as the live stitches are secured during grafting.",
      "Close the center separately:",
    ];
    let at = -1;
    for (const sentence of order) {
      const next = text.indexOf(sentence, at + 1);
      expect(next, sentence).toBeGreaterThan(at);
      at = next;
    }
    expect(html).toContain('<a href="/glossary/scrap-and-ravel-cast-on/" class="glossary-link">Scrap on</a>');
    expect(html).toContain('<a href="/glossary/scrap-off/" class="glossary-link">scrap off</a>');
    expect(html).toContain('<a href="/glossary/kitchener-stitch/" class="glossary-link">Kitchener join</a>');
    expect(html).not.toContain("Cast on ");
    expect(html).not.toContain("Bind off");
    expect(html.match(/href="\/videos\/811"/g)).toHaveLength(1);

    const wide = buildCircleCalculator(
      reviewedSample({ construction: "short-row", wedges: 8, stitches: 14, rows: 4, gaugeSpanInches: 1 }),
    );
    if (!wide.ok || wide.plan.kind !== "short-row") throw new Error("expected a short-row plan");
    const firstReturn = wide.plan.steps[0]!.returnNeedles;
    expect(firstReturn).toBeGreaterThan(1);
    expect(wide.patternHtml).toContain(`Return the first group, ${firstReturn} needles, to work next to the carriage.`);
    expect(html).not.toContain("opposite the carriage");
    expect(html.match(/main-yarn row|knit 1 row/gi)).toHaveLength(2);
    expect(wide.patternHtml).toContain(`<td>${firstReturn}</td><td>2</td>`);
  });
});

describe("limits", () => {
  it("lengthens the wedge instead of shaping more than one stitch at an edge", () => {
    const result = wedgePlan(
      reviewedSample({
        stitches: 15,
        rows: 2,
        gaugeSpanInches: 1,
      }),
    );
    const plan = result.plan;
    if (plan.kind !== "wedges") return;
    expect(plan.rowsExtended).toBe(true);
    expect(plan.totalRows).toBeGreaterThan(plan.geometricRows);
    const gaps = plan.taperRows.slice(0, -1).map((row, index, rows) =>
      index === 0 ? row.row : row.row - rows[index - 1].row,
    );
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(1);
    expect(result.patternHtml).not.toContain("rounded wedge height");
    expect(result.reviewNotes.join(" ")).toContain("Keeping one stitch at each edge");
  });
});

describe("available needles", () => {
  it("allows a wedge at, and one stitch under, the limit, and blocks one stitch over", () => {
    for (const direction of ["decrease", "increase"] as const) {
      const fitting = wedgePlan(reviewedSample({ direction, availableNeedles: 60 }));
      const exact = wedgePlan(reviewedSample({ direction, availableNeedles: 59 }));
      expect(circleRequiredNeedles(fitting.plan)).toBe(59);
      expect(circleRequiredNeedles(exact.plan)).toBe(59);
      expect(fitting.plan.kind === "wedges" && fitting.plan.outerNeedleStitches).toBe(59);
      expect(exact.patternHtml).toContain("59");

      const over = buildCircleCalculator(reviewedSample({ direction, availableNeedles: 58 }));
      expect(over.ok).toBe(false);
      if (over.ok) return;
      expect(over.errors).toEqual([circleNeedleLimitMessage(59, 58)]);
      expect("patternHtml" in over).toBe(false);
    }
  });

  it("checks one wedge, including both seaming stitches, and leaves the entered choices unchanged", () => {
    const input = reviewedSample({ wedges: 6, direction: "decrease", availableNeedles: 82 });
    const snapshot = { ...input };
    const over = buildCircleCalculator(input);
    expect(input).toEqual(snapshot);
    expect(over.ok).toBe(false);
    if (over.ok) return;
    expect(over.errors).toEqual(["This pattern needs 83 needles. You have 82 available. Try a smaller diameter."]);

    const exact = wedgePlan(reviewedSample({ wedges: 6, direction: "increase", availableNeedles: 83 }));
    expect(exact.plan.kind === "wedges" && exact.plan.wedges).toBe(6);
    expect(exact.plan.kind === "wedges" && exact.plan.outerNeedleStitches).toBe(83);
    expect(exact.patternHtml).toContain("Knit 6 wedges");
    expect(exact.patternHtml).not.toContain("two pieces");
  });

  it("counts every short-row cast-on needle, including stitches on hold", () => {
    const open = buildCircleCalculator(reviewedSample({ construction: "short-row", availableNeedles: 200 }));
    expect(open.ok).toBe(true);
    if (!open.ok || open.plan.kind !== "short-row") return;
    const required = open.plan.castOn;
    expect(required).toBe(Math.round((10 / Math.cos(Math.PI / 8)) * 7));
    expect(circleRequiredNeedles(open.plan)).toBe(required);
    const radiusOnly = buildCircleCalculator(reviewedSample({ construction: "short-row", availableNeedles: 70 }));
    expect(radiusOnly.ok).toBe(false);
    if (!radiusOnly.ok) expect(radiusOnly.errors).toEqual([circleNeedleLimitMessage(76, 70)]);
    expect(open.plan.steps[0]?.needlesWorking).toBeLessThan(required);

    const under = buildCircleCalculator(reviewedSample({ construction: "short-row", availableNeedles: required + 1 }));
    const exact = buildCircleCalculator(reviewedSample({ construction: "short-row", availableNeedles: required }));
    const oneOver = buildCircleCalculator(reviewedSample({ construction: "short-row", availableNeedles: required - 1 }));
    expect(under.ok).toBe(true);
    expect(exact.ok).toBe(true);
    expect(oneOver.ok).toBe(false);
    if (!oneOver.ok) expect(oneOver.errors).toEqual([circleNeedleLimitMessage(required, required - 1)]);
    if (exact.ok) expect(exact.patternHtml).toContain(`Scrap on</a> ${required} stitches with waste yarn.`);

    const heldOnly = open.plan.steps[0]?.needlesWorking ?? 0;
    const over = buildCircleCalculator(
      reviewedSample({ construction: "short-row", availableNeedles: heldOnly }),
    );
    expect(over.ok).toBe(false);
    if (over.ok) return;
    expect(over.errors).toEqual([circleNeedleLimitMessage(required, heldOnly)]);
    expect(over.errors.join(" ")).not.toContain("sections");
  });

  it("asks for a needle count before it builds a pattern", () => {
    const missing = buildCircleCalculator(reviewedSample({ availableNeedles: Number.NaN }));
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.errors).toContain(AVAILABLE_NEEDLES_REQUIRED_MESSAGE);
    expect("patternHtml" in missing).toBe(false);
  });
});

describe("glossary modal", () => {
  it("puts the shared glossary modal on the calculator page", () => {
    const page = readFileSync(new URL("../../pages/tools/circle-calculator.astro", import.meta.url), "utf8");
    expect(page).toContain("GlossaryTermModal");
    expect(page).toContain("One piece, one seam, short rows");
    expect(page).not.toContain("Flat short row, one seam");
    expect(page).toContain('label="Diameter"');
    expect(page).not.toContain("Finished size across opposite flat edges");
    expect(page).toContain('class="kbm-btn kbm-btn-primary"');
    expect(page).toContain('data-preview="wedges-6"');
    expect(page).toContain('data-preview="wedges-8"');
    expect(page).toContain('data-preview="short-row"');
    expect(page).not.toContain("across opposite outer points");
  });
});

function diagramFor(input: CircleCalculatorInput, unit: CircleCalculatorInput["unit"] = input.unit) {
  const result = buildCircleCalculator(input);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected a plan");
  return circleWedgeDiagramSvg(circleDiagramContent(result.plan, unit));
}

function svgText(svg: string): string {
  return svg.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

function attr(svg: string, name: string): number {
  const match = new RegExp(`(?:^|[\\s<])${name}="([^"]+)"`).exec(svg);
  return Number(match?.[1]);
}

describe("circle diagram", () => {
  it("labels the shaded top wedge from the flat-to-flat pattern", () => {
    const result = wedgePlan(reviewedSample());
    const plan = result.plan as Extract<CirclePlan, { kind: "wedges" }>;
    const svg = circleWedgeDiagramSvg(circleDiagramContent(plan, "in"));
    expect(svg).toContain("Knit 8 wedges");
    expect(svg).toContain(formatApproximateCircleLength(plan.finishedAcrossFlatsInches, "in"));
    expect(svg).not.toContain(formatCircleLength(plan.finishedAcrossFlatsInches, "in"));
    expect(svgText(svg)).toContain("Diameter Approx");
    expect(svg).not.toContain("Opposite corners");
    expect(svg).toContain("Outer edge");
    expect(svgText(svg)).toContain("59 Stitches including 2 seaming");
    expect(svg).toContain("including 2 seaming");
    expect(svg).toContain(formatCircleLength(plan.outerEdgeInches, "in"));
    expect(svg).toContain("Wedge height");
    expect(svgText(svg)).toContain(`${plan.totalRows} Rows`);
    expect(svg).toContain(formatApproximateCircleLength(plan.lengthInches, "in"));
    expect(svg).not.toContain(formatCircleLength(plan.lengthInches, "in"));
    expect(svg).not.toContain(formatCircleLength(plan.sideSeamInches, "in"));
    expect(svg).not.toContain("Knitting direction");
    expect(svg).toContain('data-knitting-direction="decrease"');
    expect(svg).toContain('data-arrow-toward="center"');
    expect(svg).toContain('fill="#f4f6f1"');
    expect(svg).toContain('fill="#738c52"');
    expect(svg).toContain('font-family="Arial, Helvetica, sans-serif"');
    expect(svg.match(/data-measure-cap="1"/g)).toHaveLength(6);
    expect(svg.match(/fill="#f4f6f1"/g)).toHaveLength(1);
    const edgeDx = attr(svg, "data-edge-dx");
    const edgeDy = attr(svg, "data-edge-dy");
    const heightDx = attr(svg, "data-dx");
    const heightDy = attr(svg, "data-dy");
    expect(Math.abs(edgeDy)).toBeLessThan(0.05);
    expect(Math.abs(attr(svg, "data-top-edge-y1") - attr(svg, "data-top-edge-y2"))).toBeLessThan(0.05);
    expect(attr(svg, "data-across-x1")).toBe(attr(svg, "data-across-x2"));
    expect(attr(svg, "data-across-y1")).not.toBe(attr(svg, "data-across-y2"));
    expect(Math.abs(edgeDx * heightDx + edgeDy * heightDy)).toBeLessThan(0.25);
    const centerToInner = Math.hypot(attr(svg, "data-inner-x") - attr(svg, "data-center-x"), attr(svg, "data-inner-y") - attr(svg, "data-center-y"));
    const centerToOuter = Math.hypot(attr(svg, "data-outer-x") - attr(svg, "data-center-x"), attr(svg, "data-outer-y") - attr(svg, "data-center-y"));
    expect(centerToInner / centerToOuter).toBeCloseTo(1 / plan.outerBodyStitches, 2);
    expect(centerToInner).toBeLessThan(centerToOuter);
    const tip = Math.hypot(attr(svg, "data-tip-x") - attr(svg, "data-center-x"), attr(svg, "data-tip-y") - attr(svg, "data-center-y"));
    const tail = Math.hypot(attr(svg, "data-tail-x") - attr(svg, "data-center-x"), attr(svg, "data-tail-y") - attr(svg, "data-center-y"));
    expect(tip).toBeLessThan(tail);
  });

  it("points an increase arrow toward the outer edge", () => {
    const svg = diagramFor(reviewedSample({ direction: "increase" }));
    expect(svg).toContain('data-arrow-toward="outer"');
    const tip = Math.hypot(attr(svg, "data-tip-x") - attr(svg, "data-center-x"), attr(svg, "data-tip-y") - attr(svg, "data-center-y"));
    const tail = Math.hypot(attr(svg, "data-tail-x") - attr(svg, "data-center-x"), attr(svg, "data-tail-y") - attr(svg, "data-center-y"));
    expect(tip).toBeGreaterThan(tail);
  });

  it("uses the selected unit for every measurement and keeps the stitch and row counts", () => {
    const inches = diagramFor(reviewedSample(), "in");
    const centimeters = diagramFor(reviewedSample(), "cm");
    const plan = wedgePlan(reviewedSample()).plan;
    expect(centimeters).toContain(formatApproximateCircleLength(plan.finishedAcrossFlatsInches, "cm"));
    expect(centimeters).toContain(formatCircleLength(plan.outerEdgeInches, "cm"));
    expect(centimeters).toContain(formatApproximateCircleLength(plan.lengthInches, "cm"));
    expect(centimeters).not.toContain(formatCircleLength(plan.lengthInches, "cm"));
    expect(svgText(centimeters)).toContain(`${plan.outerNeedleStitches} Stitches`);
    expect(svgText(centimeters)).toContain(`${plan.totalRows} Rows`);
    expect(centimeters).not.toMatch(/\d+\.\d+ in/);
    expect(inches).not.toContain(" cm");

    const six = diagramFor(reviewedSample({ wedges: 6, direction: "increase" }));
    expect(six).toContain("Knit 6 wedges");
    expect(svgText(six)).toContain("83 Stitches");
    expect(six).toContain("including 2 seaming");
    expect(six).not.toContain("Knit 8 wedges");
    expect(six).toContain('data-arrow-toward="outer"');
  });

  it("redraws finished measurements in the other unit without changing the knitting counts", () => {
    const result = wedgePlan(reviewedSample());
    const plan = result.plan;
    const centimeters = circleInstructionsHtml(reviewedSample(), plan, "cm");
    expect(centimeters).not.toContain("circle-measures");
    expect(centimeters).not.toContain("50.41 cm");
    expect(centimeters).toContain(`${plan.kind === "wedges" ? plan.outerNeedleStitches : 0} stitches`);
    expect(centimeters).toContain("in 1 inch");
    expect(centimeters).not.toMatch(/\d+\.\d+ cm/);
    const diagram = circleWedgeDiagramSvg(circleDiagramContent(plan, "cm"));
    expect(diagram).toContain(
      formatApproximateCircleLength(plan.kind === "wedges" ? plan.finishedAcrossFlatsInches : 0, "cm"),
    );
    expect(svgText(diagram)).toContain(`${plan.kind === "wedges" ? plan.totalRows : 0} Rows`);
    expect(svgText(diagram)).toContain("59 Stitches");
  });

  it("draws a flat-top short-row pinwheel for the selected section count", () => {
    for (const sections of [6, 8] as const) {
      const result = buildCircleCalculator(reviewedSample({ construction: "short-row", wedges: sections }));
      expect(result.ok).toBe(true);
      if (!result.ok || result.plan.kind !== "short-row") return;
      const plan = result.plan;
      const svg = circleWedgeDiagramSvg(circleDiagramContent(plan, "in"));
      expect(svg).toContain(`Work ${sections} short-row sections`);
      expect(svg).not.toContain(`Knit ${sections} wedges`);
      expect(svgText(svg)).toContain("Diameter Approx");
      expect(svg).not.toContain("Across opposite flat edges.");
      expect(svg).not.toContain("Opposite corners");
      expect(svg).not.toContain("opposite outer points");
      expect(svg).toContain(formatApproximateCircleLength(plan.finishedAcrossFlatsInches, "in"));
      expect(svg).not.toContain(formatCircleLength(plan.finishedAcrossFlatsInches, "in"));
      expect(svgText(svg)).toContain(`Center to corner ${plan.castOn} Stitches`);
      expect(svg).not.toContain("Stitches across");
      expect(svg).toContain(formatCircleLength(plan.castOn / plan.stitchesPerInch, "in"));
      expect(svg).toContain("Rows per section");
      expect(svgText(svg)).toContain(`${plan.rowsPerWedge} Rows`);
      expect(svg).toContain(formatCircleLength(plan.rowsPerWedge / plan.rowsPerInch, "in"));
      expect(svgText(svg)).not.toContain(`${plan.rowsPerWedge * sections} Rows`);
      expect(svg).toContain('data-pinwheel="1"');
      expect(svg).toContain(`data-sections="${sections}"`);
      expect(svg).toContain('data-shaded-section="1"');
      expect(svg).not.toContain('data-spoke="1"');
      const pinwheel = svg.match(/data-pinwheel="1"[^>]*>([\s\S]*?)<\/g>/);
      expect(pinwheel?.[1].match(/ Q /g)?.length).toBe(sections);
      expect(svg.match(/fill="#f4f6f1"/g)).toHaveLength(1);
      expect(svg).toContain('font-family="Arial, Helvetica, sans-serif"');
      expect(svg.match(/data-measure-cap="1"/g)).toHaveLength(6);
      expect(Math.abs(attr(svg, "data-top-edge-y1") - attr(svg, "data-top-edge-y2"))).toBeLessThan(0.05);
      expect(attr(svg, "data-across-x1")).toBe(attr(svg, "data-across-x2"));
      expect(attr(svg, "data-across-y1")).not.toBe(attr(svg, "data-across-y2"));
      expect(Math.abs(attr(svg, "data-edge-dy"))).toBeLessThan(0.05);
      expect(svg).not.toContain("data-section-stitches");
      const from: [number, number] = [attr(svg, "data-from-x"), attr(svg, "data-from-y")];
      const to: [number, number] = [attr(svg, "data-to-x"), attr(svg, "data-to-y")];
      const vertices = [...svg.matchAll(/<polygon points="([^"]+)" fill="none"/g)][0]![1]
        .trim()
        .split(/\s+/)
        .map((pair) => pair.split(",").map(Number));
      expect(vertices).toHaveLength(sections);
      const corner = vertices.find(([x, y]) => Math.hypot(x - to[0], y - to[1]) < 0.05);
      expect(corner, "measure ends at a corner").toBeDefined();
      const shapeCenterX = vertices.reduce((sum, [x]) => sum + x, 0) / sections;
      const shapeCenterY = vertices.reduce((sum, [, y]) => sum + y, 0) / sections;
      expect(Math.hypot(from[0] - shapeCenterX, from[1] - shapeCenterY)).toBeLessThan(0.05);

      const centimeters = circleWedgeDiagramSvg(circleDiagramContent(plan, "cm"));
      expect(centimeters).toContain(formatApproximateCircleLength(plan.finishedAcrossFlatsInches, "cm"));
      expect(centimeters).not.toContain(formatCircleLength(plan.finishedAcrossFlatsInches, "cm"));
      expect(svgText(centimeters)).toContain(`${plan.castOn} Stitches`);
      expect(svgText(centimeters)).toContain(`${plan.rowsPerWedge} Rows`);
      expect(centimeters).not.toMatch(/\d+\.\d+ in/);
    }
  });

  it("keeps the phone layout narrow and moves the side labels below the shape", () => {
    const viewBox = (svg: string) => svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)!.slice(1).map(Number);
    const baselines = (svg: string, text: string) =>
      [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*>(.*?)<\/text>/g)]
        .filter((match) => match[3].replace(/<[^>]+>/g, "").includes(text))
        .map((match) => Number(match[2]));
    for (const input of [
      reviewedSample(),
      reviewedSample({ wedges: 6, direction: "increase" }),
      reviewedSample({ construction: "short-row", wedges: 8 }),
    ]) {
      const result = buildCircleCalculator(input);
      if (!result.ok) throw new Error("expected a plan");
      for (const unit of ["in", "cm"] as const) {
        const content = circleDiagramContent(result.plan, unit);
        const wide = circleWedgeDiagramSvg(content, "wide");
        const narrow = circleWedgeDiagramSvg(content, "narrow");
        expect(circleWedgeDiagramSvg(content)).toBe(wide);
        expect(narrow).toContain('data-layout="narrow"');
        expect(viewBox(narrow)[0]).toBeLessThan(viewBox(wide)[0] * 0.55);
        expect(svgText(narrow)).toBe(svgText(wide));
        expect(narrow.match(/font-size="([\d.]+)"/)?.[1]).toBe(wide.match(/font-size="([\d.]+)"/)?.[1]);
        const shapeBottom = attr(narrow, "data-across-y2");
        expect(Math.min(...baselines(narrow, content.overallCaption))).toBeGreaterThan(shapeBottom);
        const sideCaption = content.wedge ? "Wedge height" : "Center to corner";
        expect(Math.min(...baselines(narrow, sideCaption))).toBeGreaterThan(shapeBottom);
        expect(Math.max(...baselines(wide, sideCaption))).toBeLessThan(attr(wide, "data-across-y2"));
      }
    }
  });

  it("reports the approximate circumference for both constructions", () => {
    const shortRow = buildCircleCalculator(reviewedSample({ construction: "short-row", wedges: 8 }));
    if (!shortRow.ok) throw new Error("short-row sample failed");
    expect(circleCircumferenceInches(shortRow.plan)).toBeCloseTo((84 * 8 + 1) / 10, 10);
    expect(circleCircumferenceText(shortRow.plan, "in")).toBe("Approximate circumference: 67.3 in");
    expect(circleCircumferenceText(shortRow.plan, "cm")).toBe("Approximate circumference: 170.9 cm");

    const wedges = wedgePlan(reviewedSample()).plan;
    expect(circleCircumferenceInches(wedges)).toBeCloseTo((57 / 7) * 8, 10);
    expect(circleCircumferenceText(wedges, "in")).toBe("Approximate circumference: 65.1 in");
    expect(circleCircumferenceText(wedges, "cm")).toBe("Approximate circumference: 165.5 cm");
  });

  it("rounds wedge height and flat-to-flat size without using twice the height", () => {
    for (const wedges of [6, 8] as const) {
      const plan = wedgePlan(reviewedSample({ wedges })).plan;
      if (plan.kind !== "wedges") return;
      for (const unit of ["in", "cm"] as const) {
        const svg = circleWedgeDiagramSvg(circleDiagramContent(plan, unit));
        const height = formatApproximateCircleLength(plan.lengthInches, unit);
        const flats = formatApproximateCircleLength(plan.finishedAcrossFlatsInches, unit);
        const twiceHeight = formatApproximateCircleLength(2 * plan.lengthInches, unit);
        expect(svg).toContain("Wedge height");
        expect(svgText(svg)).toContain(`${plan.totalRows} Rows`);
        expect(svg).toContain(height);
        expect(svg).toContain(flats);
        expect(svg).toContain(formatCircleLength(plan.outerEdgeInches, unit));
        expect(svg).not.toContain(formatCircleLength(plan.lengthInches, unit));
        expect(svg).not.toContain(formatCircleLength(plan.finishedAcrossFlatsInches, unit));
        if (twiceHeight !== flats) expect(svg).not.toContain(twiceHeight);
      }
    }
    const eight = wedgePlan(reviewedSample()).plan;
    const six = wedgePlan(reviewedSample({ wedges: 6 })).plan;
    if (eight.kind !== "wedges" || six.kind !== "wedges") return;
    expect(formatApproximateCircleLength(eight.lengthInches, "in")).toBe("Approx 10 in");
    expect(formatApproximateCircleLength(eight.finishedAcrossFlatsInches, "in")).toBe("Approx 20 in");
    expect(eight.totalRows).toBe(97);
    expect(formatApproximateCircleLength(2 * eight.lengthInches, "in")).toBe("Approx 19 in");
    expect(formatApproximateCircleLength(six.finishedAcrossFlatsInches, "cm")).toBe("Approx 51 cm");
    expect(formatApproximateCircleLength(2 * six.lengthInches, "cm")).toBe("Approx 50 cm");
    expect(formatCircleLength(eight.outerEdgeInches, "in")).toBe("8.14 in");
  });
});
