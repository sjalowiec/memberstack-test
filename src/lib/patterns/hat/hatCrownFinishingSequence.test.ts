import { describe, expect, it } from "vitest";
import {
  convertLength,
  formatLength,
} from "../../../components/wizards/utils/unitHelpers";
import {
  buildFourWedgeCrownSetup,
  buildFourWedgeDecreaseSchedule,
  calculateHatPattern,
  gatheredCrownRemainingStitches,
  hatCrownEndingRow,
} from "./hatMath";
import { buildHatPatternHtml } from "./hatInstructions";

const formatters = {
  convertLength: convertLength as (v: number, from: string, to: string) => number,
  formatLength: formatLength as (v: number, unit: string) => string,
};

function calcFor(
  crown: string,
  overrides: Partial<Parameters<typeof calculateHatPattern>[0]> = {},
) {
  return calculateHatPattern({
    finishedHatCircInches: 20.5,
    stitchGaugeDisplay: 5,
    rowGaugeDisplay: 7,
    displayUnit: "inches",
    totalHatLengthInches: 8.5,
    brimDepthInches: 2,
    brimType: "single",
    crown,
    suggestedCrownDepthInches: 2.5,
    fit: "watchcap",
    ...overrides,
  });
}

function patternHtml(
  crown: string,
  overrides: Partial<Parameters<typeof calculateHatPattern>[0]> = {},
) {
  const calc = calcFor(crown, overrides);
  return {
    calc,
    html: buildHatPatternHtml({
      calc,
      currentUnit: "inches",
      scrapOffPatternTooltip: "Scrap Off",
      tipsIntroHtml: "",
      showTips: true,
      formatters,
    }),
  };
}

function sectionHtml(html: string, sectionId: string): string {
  const start = html.indexOf(`data-section-id="${sectionId}"`);
  if (start < 0) return "";
  const end = html.indexOf("</section>", start);
  return end < 0 ? html.slice(start) : html.slice(start, end);
}

function expectPhraseOrder(html: string, phrases: string[]) {
  let pos = 0;
  for (const phrase of phrases) {
    const idx = html.indexOf(phrase, pos);
    expect(idx, `missing or out of order: "${phrase}"`).toBeGreaterThan(-1);
    pos = idx + phrase.length;
  }
}

describe("hat crown finishing sequence", () => {
  it("gathered: live stitches leave the machine before gathering, seaming, and optional blocking", () => {
    const { calc, html } = patternHtml("gathered", {
      finishedHatCircInches: 22,
      stitchGaugeDisplay: 16,
      rowGaugeDisplay: 28,
      brimType: "folded",
      brimDepthInches: 3,
      suggestedCrownDepthInches: 10 / 7,
      totalHatLengthInches: 7 + 10 / 7,
      fit: "custom",
    });
    const remaining = gatheredCrownRemainingStitches(calc.castOnSts);
    const ending = hatCrownEndingRow(calc);
    const crown = sectionHtml(html, "crown");
    const finishing = sectionHtml(html, "finishing");

    expect(calc.brimRows).toBe(42);
    expect(calc.bodyRows).toBe(28);
    expect(calc.crownRowCount).toBe(10);
    expect(remaining).toBe(44);

    expectPhraseOrder(html, [
      "Work 28 rows in pattern after the brim",
      "Begin crown shaping at RC 70.",
      `Knit 10 rows. RC is now ${ending}.`,
      `Break the yarn, leaving a 12" tail.`,
      `Thread the tail through the remaining ${remaining} stitches`,
      "remove the stitches from the machine.",
      "Pull the tail firmly to gather the top of the hat and secure.",
      "Use the tail to seam the body using",
      "mattress stitch",
      "Work in yarn ends.",
      "Block if desired.",
    ]);

    expect(crown).toContain(`Knit 10 rows. RC is now ${ending}.`);
    expect(crown).toContain(`Break the yarn, leaving a 12" tail.`);
    expect(crown).toContain(
      `Thread the tail through the remaining ${remaining} stitches`,
    );
    expect(crown).toContain("remove the stitches from the machine.");
    expect(crown).not.toContain("Pull the tail firmly");
    expect(crown).not.toContain("Block");
    expect(crown).not.toContain("gather the remaining");

    expect(finishing).toContain(
      "Pull the tail firmly to gather the top of the hat and secure.",
    );
    expect(finishing).toContain("Use the tail to seam the body using");
    expect(finishing).toContain("Work in yarn ends.");
    expect(finishing).toContain("Block if desired.");
    expect(finishing).not.toContain("Block the hat to set the shape.");
    expect(finishing).not.toContain("remove the stitches from the machine.");

    const blockIdx = html.indexOf("Block if desired.");
    const pullIdx = html.indexOf(
      "Pull the tail firmly to gather the top of the hat and secure.",
    );
    const removeIdx = html.indexOf("remove the stitches from the machine.");
    expect(blockIdx).toBeGreaterThan(pullIdx);
    expect(pullIdx).toBeGreaterThan(removeIdx);
    expect(html.indexOf("Block the hat to set the shape.")).toBe(-1);
  });

  it("four-gore: scrap-off, each wedge is taken off the machine, then wedges are seamed before optional blocking", () => {
    const { calc, html } = patternHtml("wedge-4-decrease");
    const setup = buildFourWedgeCrownSetup({
      castOnSts: calc.castOnSts,
      crown: calc.crown,
      brimRows: calc.brimRows,
      bodyRows: calc.bodyRows,
    });
    expect(setup).not.toBeNull();
    const schedule = buildFourWedgeDecreaseSchedule(setup!.wedgeStitchCount);
    const remainVerb =
      schedule.finalWedgeStitchCount === 1 ? "stitch remains" : "stitches remain";
    const threadPhrase =
      schedule.finalWedgeStitchCount === 1
        ? "Thread the tail through the remaining stitch and remove it from the machine."
        : `Thread the tail through the remaining ${schedule.finalWedgeStitchCount} stitches and remove the stitches from the machine.`;

    expectPhraseOrder(html, [
      `Work ${calc.bodyRows} rows in pattern after the brim`,
      `Begin crown shaping at RC ${calc.brimRows + calc.bodyRows}.`,
      "Scrap off",
      `${setup!.scrapOffStitchCount} stitches from needles`,
      `Knit Wedge 1 over ${setup!.wedgeStitchCount} stitches`,
      `When ${schedule.finalWedgeStitchCount} ${remainVerb}, break the yarn, leaving a tail.`,
      threadPhrase,
      `Pick up and rehang ${setup!.wedgeStitchCount} stitches`,
      "Seam each crown wedge first, then seam the body using",
      "mattress stitch",
      "Work in yarn ends.",
      "Block if desired.",
    ]);

    for (const sectionId of [
      "crown-wedge-1",
      "crown-wedge-2",
      "crown-wedge-3",
      "crown-wedge-4",
    ]) {
      const section = sectionHtml(html, sectionId);
      expect(section).toContain(
        `When ${schedule.finalWedgeStitchCount} ${remainVerb}, break the yarn, leaving a tail.`,
      );
      expect(section).toContain(threadPhrase);
      expect(section).not.toContain("break yarn and secure");
      expect(section).not.toContain("Block");
    }

    const finishing = sectionHtml(html, "finishing");
    expect(finishing).not.toContain("Block the hat to set the shape.");
    expect(finishing.indexOf("Block if desired.")).toBeGreaterThan(
      finishing.indexOf("Seam each crown wedge first"),
    );
    expect(html).not.toContain("Gather the remaining stitches");
    expect(html).not.toContain("Run the end of the yarn through the remaining stitches");
  });

  it("swirl: last decrease row, then thread remaining live stitches off the machine before seaming", () => {
    const { calc, html } = patternHtml("spiral");
    const target = calc.crownPlan.spiral?.targetStitches ?? 6;
    const lastRowLabel = `<strong class="pattern-row-label">Row `;
    const finishing = sectionHtml(html, "finishing");
    const crown = sectionHtml(html, "crown");

    expectPhraseOrder(html, [
      `Work ${calc.bodyRows} rows in pattern after the brim`,
      `Begin crown shaping at RC ${calc.brimRows + calc.bodyRows}.`,
      lastRowLabel,
      `Break the yarn, leaving a 12" tail.`,
      `Thread the tail through the remaining ${target} stitches and remove the stitches from the machine.`,
      "Tighten and tie off, leaving a tail to sew the seam.",
      "Seam the body using",
      "mattress stitch",
      "Work in yarn ends.",
      "Block if desired.",
    ]);

    expect(crown).toContain(
      `Thread the tail through the remaining ${target} stitches and remove the stitches from the machine.`,
    );
    expect(crown).not.toContain("Gather the remaining stitches and secure.");
    expect(crown).not.toContain("Block");

    expect(finishing).toContain("Tighten and tie off, leaving a tail to sew the seam.");
    expect(finishing).toContain("Seam the body using");
    expect(finishing).toContain("Work in yarn ends.");
    expect(finishing).toContain("Block if desired.");
    expect(finishing).not.toContain("Run the end of the yarn through the remaining stitches");
    expect(finishing).not.toContain("remove the stitches from the machine.");
    expect(finishing).not.toContain("Block the hat to set the shape.");

    const removeIdx = html.indexOf("remove the stitches from the machine.");
    const tightenIdx = html.indexOf("Tighten and tie off");
    const seamIdx = html.indexOf("Seam the body using");
    const blockIdx = html.indexOf("Block if desired.");
    expect(tightenIdx).toBeGreaterThan(removeIdx);
    expect(seamIdx).toBeGreaterThan(tightenIdx);
    expect(blockIdx).toBeGreaterThan(seamIdx);
  });

  it("does not present blocking as a required step before the crown is secured", () => {
    for (const crown of ["gathered", "spiral", "wedge-4-decrease"] as const) {
      const { html } = patternHtml(crown);
      expect(html).toContain("Block if desired.");
      expect(html).not.toContain("Block the hat to set the shape.");
      const finishing = sectionHtml(html, "finishing");
      const blockIdx = finishing.lastIndexOf("Block if desired.");
      expect(blockIdx).toBeGreaterThan(-1);
      expect(blockIdx).toBeGreaterThan(finishing.indexOf("Work in yarn ends."));
    }
  });
});
