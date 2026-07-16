import { describe, expect, it } from "vitest";
import {
  armholeAlternateTechniquesHelpCardBodyHtml,
  ARMHOLE_BIND_OFF_TRICK_VIDEO_KEY,
  ARMHOLE_RC_FROM_RESET_NOTE,
  generateSleevelessBackPattern,
  type SleevelessPatternDisplayRow,
} from "./sleevelessPatternOutput";
import { armholeBindOffDecreaseFromEachSide } from "./sleevelessBackJapaneseNotation";
import { buildFrontJapaneseNotationReplacements } from "./sleevelessFrontJapaneseNotation";
import {
  armholeLocalRcActiveShoulderChecklistStart,
  armholeLocalRcCenterNecklineSetupRow,
  armholeLocalRcFirstActiveSideNecklineShapingAction,
  buildActiveSideInstructionTableRows,
  isCenterNecklineSetupChecklistRow,
} from "./neckShoulderActiveSideChecklist";
import { NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL } from "./neckShoulderShapingChart";

function basePattern(styleNeckline: string): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 22,
        armhole_depth: 8,
        neck_opening: 3,
        shoulder_width: 4.25,
        front_neck_depth: 3,
        back_neck_depth: 1,
      },
    },
    style: {
      recipientCategory: "misses",
      neckline: styleNeckline,
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function collectParagraphs(rows: readonly SleevelessPatternDisplayRow[]): string[] {
  const out: string[] = [];
  for (const row of rows) {
    if (row.kind === "block") {
      // Glossary blocks may carry only trustedParagraphs (plain paragraphs omitted).
      out.push(...(row.paragraphs ?? []), ...(row.trustedParagraphs ?? []));
    }
  }
  return out;
}

function armholeSectionParagraphs(rows: readonly SleevelessPatternDisplayRow[]): string[] {
  const out: string[] = [];
  let inArmhole = false;
  for (const row of rows) {
    if (row.kind === "section") {
      inArmhole = row.title === "ARMHOLE";
      continue;
    }
    if (!inArmhole || row.kind !== "block") continue;
    out.push(...row.paragraphs);
  }
  return out;
}

function firstArmholeBlock(rows: readonly SleevelessPatternDisplayRow[]) {
  let inArmhole = false;
  for (const row of rows) {
    if (row.kind === "section") {
      inArmhole = row.title === "ARMHOLE";
      continue;
    }
    if (inArmhole && row.kind === "block") return row;
  }
  return undefined;
}

function cardiganPattern(): Record<string, unknown> {
  return {
    ...basePattern("round"),
    style: { recipientCategory: "misses", neckline: "round", frontStyle: "open" },
  };
}

function firstFrontNecklineShapingActionRc(
  chart: Parameters<typeof buildActiveSideInstructionTableRows>[0],
  armholeStart: number | undefined,
): number | undefined {
  const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, armholeStart);
  const rows = buildActiveSideInstructionTableRows(chart, rcStart);
  const shaping = rows.filter((row) => row.action !== NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL);
  const firstNeck = shaping.find((row) => row.edge === "Neck");
  return (firstNeck ?? shaping[0])?.rc;
}

/**
 * Armhole RC of the center neckline divide/setup row exactly as rendered in the Front Neckline
 * chart (built with the same `includeCenterNecklineSetupRow` option the page uses). This is the
 * chart's "Scrap off center … to divide" row that the prose must match.
 */
function frontNecklineChartCenterDivideRc(
  chart: Parameters<typeof buildActiveSideInstructionTableRows>[0],
  armholeStart: number | undefined,
): number | undefined {
  const options = { includeCenterNecklineSetupRow: true as const };
  const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, armholeStart, options);
  const rows = buildActiveSideInstructionTableRows(chart, rcStart, options);
  return rows.find((row) => isCenterNecklineSetupChecklistRow(row))?.rc;
}

describe("sleeveless armhole RC wording", () => {
  it("back ARMHOLE section uses bind off OR hold wording and alternate-techniques tip", () => {
    const r = generateSleevelessBackPattern(basePattern("round"));
    const armhole = armholeSectionParagraphs(r.displayRows);
    expect(armhole.some((p) => /bind off \/ hold/i.test(p))).toBe(false);
    expect(armhole.some((p) => /bind off OR hold \d+ stitches at the armhole edge/i.test(p))).toBe(
      true
    );
    expect(armhole.some((p) => /bind off OR hold \d+ stitches at the remaining armhole edge/i.test(p))).toBe(
      true
    );
    const first = firstArmholeBlock(r.displayRows);
    expect(first?.tipPresentation).toBe("help-card");
    expect(first?.tipHtmlIsFull).toBe(true);
    expect(first?.tipHtml).toContain("pattern-help-card__details");
    expect(first?.tipHtml).toContain(armholeAlternateTechniquesHelpCardBodyHtml());
    expect(first?.tipHtml).toContain("hold stitches or use short-row shaping");
    expect(first?.tipHtml).toContain("Cleaner Partial Bind-Off Edge");
    expect(first?.tipHtml).toContain(`data-sleeveless-help-video="${ARMHOLE_BIND_OFF_TRICK_VIDEO_KEY}"`);
    expect(first?.tipHtml).toContain("Bind Off Trick");
  });

  it("front ARMHOLE section shares the same alternate-techniques tip with bind-off video", () => {
    const r = generateSleevelessBackPattern(basePattern("round"));
    const first = firstArmholeBlock(r.frontDisplayRows);
    expect(first?.tipPresentation).toBe("help-card");
    expect(first?.tipHtml).toContain(armholeAlternateTechniquesHelpCardBodyHtml());
    expect(first?.tipHtml).toContain(`data-sleeveless-help-video="${ARMHOLE_BIND_OFF_TRICK_VIDEO_KEY}"`);
  });

  it("back ARMHOLE section omits the reset explanatory note and uses Armhole RC targets (not body RC)", () => {
    const r = generateSleevelessBackPattern(basePattern("round"));
    const armhole = armholeSectionParagraphs(r.displayRows);
    expect(armhole.some((p) => p.includes(ARMHOLE_RC_FROM_RESET_NOTE))).toBe(false);
    expect(
      armhole.some(
        (p) =>
          /Knit to Armhole RC:\d{3}/i.test(p) || /knit in pattern to Armhole RC:\d{3}/i.test(p)
      )
    ).toBe(true);
    expect(armhole.some((p) => /^Knit to RC:\d{3}\.$/i.test(p.trim()))).toBe(false);
    expect(armhole.some((p) => /^Knit to RC \d+\.$/i.test(p.trim()))).toBe(false);
  });

  it("V-neck front milestone explains Armhole RC after reset (pullover has no intro block)", () => {
    const r = generateSleevelessBackPattern(basePattern("v-neck"));
    const frontParas = collectParagraphs(r.frontDisplayRows);
    // Full-width (pullover) fronts intentionally omit the cardigan-only intro that carried the
    // "After the armhole reset…" sentence; Armhole RC targets + milestones convey the same rule.
    expect(
      frontParas.some((p) => p.includes("After the armhole reset, use Armhole RC"))
    ).toBe(false);
    expect(
      frontParas.some((p) =>
        /row counter was reset at the beginning of armhole shaping/i.test(p)
      )
    ).toBe(true);
    expect(
      frontParas.some((p) => /Front neckline \(V-neck\) shaping begins at Armhole RC/i.test(p))
    ).toBe(true);
    const localNeck = r.debug.frontNecklineShapingBeginLocalRC;
    expect(localNeck).toBeDefined();
    const neckPadded = String(Math.max(0, Math.floor(localNeck!))).padStart(3, "0");
    expect(
      frontParas.some((p) => p.includes(`Armhole RC ${neckPadded}`) || p.includes(`Armhole RC ${localNeck}`))
    ).toBe(true);
  });

  it("round-neck front omits the reset note and uses Armhole RC targets", () => {
    const r = generateSleevelessBackPattern(basePattern("round"));
    const armhole = armholeSectionParagraphs(r.frontDisplayRows);
    expect(armhole.some((p) => p.includes(ARMHOLE_RC_FROM_RESET_NOTE))).toBe(false);
    expect(armhole.some((p) => /Armhole RC:\d{3}/i.test(p))).toBe(true);
  });

  it("body section still uses garment RC knit-to (not Armhole RC)", () => {
    const r = generateSleevelessBackPattern(basePattern("v-neck"));
    let inBody = false;
    let bodyKnitTo: string | undefined;
    for (const row of r.frontDisplayRows) {
      if (row.kind === "section" && row.title === "BODY") inBody = true;
      if (row.kind === "section" && row.title !== "BODY") inBody = false;
      if (!inBody || row.kind !== "block") continue;
      const p = row.paragraphs[0]?.trim() ?? "";
      if (/^Knit to /i.test(p)) bodyKnitTo = p;
    }
    expect(bodyKnitTo).toBeDefined();
    expect(bodyKnitTo).toMatch(/^Knit to RC \d+\.$/);
    expect(bodyKnitTo).not.toMatch(/Armhole/i);
  });

  it("cardigan front RC:000 bind-off matches diagram initial armhole hold count (per-edge back plan)", () => {
    const r = generateSleevelessBackPattern(cardiganPattern());
    const eachSide = r.debug.armholeStitchesEachSide;
    expect(eachSide).toBeDefined();
    const { bindOffSts, decreaseSts } = armholeBindOffDecreaseFromEachSide(eachSide!);
    expect(bindOffSts).toBeGreaterThan(0);
    expect(bindOffSts).not.toBe(decreaseSts);

    const armhole = armholeSectionParagraphs(r.frontDisplayRows);
    expect(
      armhole.some((p) =>
        new RegExp(
          `Bind off OR hold ${bindOffSts} stitches at the armhole edge \\(carriage side\\)\\. Knit across\\.`,
          "i",
        ).test(p),
      ),
    ).toBe(true);

    const repl = buildFrontJapaneseNotationReplacements(r, cardiganPattern());
    expect(repl["jp-armhole-bo"]).toBe(`bo${bindOffSts}`);
  });

  it("front shaping-begin debug RC still tracks the first generated neckline shaping table row", () => {
    for (const pattern of [basePattern("round"), cardiganPattern()]) {
      const r = generateSleevelessBackPattern(pattern);
      const armholeStart = r.debug.armholeStartRow;
      const tableRc = firstFrontNecklineShapingActionRc(
        r.frontNeckShoulderShapingChart,
        armholeStart,
      );
      const helperRc = armholeLocalRcFirstActiveSideNecklineShapingAction(
        r.frontNeckShoulderShapingChart,
        armholeStart,
      );
      expect(helperRc).toBe(tableRc);
      expect(r.debug.frontNecklineShapingBeginLocalRC).toBe(tableRc);
    }
  });

  it("cardigan front (no center divide) milestone RC matches first generated neckline shaping table row", () => {
    const r = generateSleevelessBackPattern(cardiganPattern());
    const armholeStart = r.debug.armholeStartRow;
    // Cardigan front has no center scrap-off divide row, so the milestone keeps the shaping-action RC.
    expect(
      frontNecklineChartCenterDivideRc(r.frontNeckShoulderShapingChart, armholeStart),
    ).toBeUndefined();
    expect(r.debug.frontNecklineCenterDivideLocalRC).toBeUndefined();

    const tableRc = firstFrontNecklineShapingActionRc(r.frontNeckShoulderShapingChart, armholeStart);
    const neckPadded = String(Math.max(0, Math.floor(tableRc ?? 0))).padStart(3, "0");
    const frontParas = collectParagraphs(r.frontDisplayRows);
    expect(
      frontParas.some((p) => p.includes(`Front neckline shaping begins at Armhole RC ${neckPadded}`)),
    ).toBe(true);
  });

  it("round-neck front summary + instruction RC match the Front Neckline chart center divide row (no two-row drift)", () => {
    const r = generateSleevelessBackPattern(basePattern("round"));
    const armholeStart = r.debug.armholeStartRow;

    // Source of truth: the chart's rendered "Scrap off center … to divide" setup row.
    const divideRc = frontNecklineChartCenterDivideRc(r.frontNeckShoulderShapingChart, armholeStart);
    expect(divideRc).toBeDefined();

    // The debug field that both the page 8 summary and the page 9 instruction read from
    // must equal the chart's center divide row RC (and the shared helper agrees).
    expect(r.debug.frontNecklineCenterDivideLocalRC).toBe(divideRc);
    expect(
      armholeLocalRcCenterNecklineSetupRow(r.frontNeckShoulderShapingChart, armholeStart, {
        includeCenterNecklineSetupRow: true,
      }),
    ).toBe(divideRc);

    const dividePadded = String(Math.max(0, Math.floor(divideRc!))).padStart(3, "0");
    const frontParas = collectParagraphs(r.frontDisplayRows);

    // Page 8 summary milestone uses the chart's divide row RC.
    expect(
      frontParas.some((p) => p.includes(`Front neckline shaping begins at Armhole RC ${dividePadded}`)),
    ).toBe(true);

    // Regression guard: the divide row and the first shaping action differ for this pattern,
    // and the summary must NOT report the (later) first-shaping-action RC as the start.
    const shapingBeginRc = r.debug.frontNecklineShapingBeginLocalRC;
    expect(shapingBeginRc).toBeDefined();
    expect(shapingBeginRc).not.toBe(divideRc);
    const shapingPadded = String(Math.max(0, Math.floor(shapingBeginRc!))).padStart(3, "0");
    expect(
      frontParas.some((p) =>
        p.includes(`Front neckline shaping begins at Armhole RC ${shapingPadded}`),
      ),
    ).toBe(false);
  });
});
