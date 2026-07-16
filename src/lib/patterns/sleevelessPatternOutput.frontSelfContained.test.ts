import { describe, expect, it } from "vitest";
import {
  generateSleevelessBackPattern,
  type SleevelessPatternDisplayRow,
} from "./sleevelessPatternOutput";

function alinePullover(): Record<string, unknown> {
  return {
    fit: {
      selectedMeasurements: {
        finished_bust_chest: 40,
        finished_hip: 48,
        back_neck_to_hem: 22,
        armhole_depth: 8,
        neck_opening: 3,
        shoulder_width: 4.25,
        front_neck_depth: 3,
        back_neck_depth: 1,
      },
    },
    style: { recipientCategory: "misses", neckline: "round", bodyShape: "aline" },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 7,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function alineCardigan(): Record<string, unknown> {
  return {
    ...alinePullover(),
    style: {
      recipientCategory: "misses",
      neckline: "round",
      frontStyle: "open",
      bodyShape: "aline",
    },
  };
}

function collectParagraphs(rows: readonly SleevelessPatternDisplayRow[]): string[] {
  const out: string[] = [];
  for (const row of rows) {
    if (row.kind === "block") {
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
    out.push(...(row.paragraphs ?? []), ...(row.trustedParagraphs ?? []));
  }
  return out;
}

function bodyShapingChartRcs(rows: readonly SleevelessPatternDisplayRow[]): number[] {
  let inBody = false;
  const out: number[] = [];
  for (const row of rows) {
    if (row.kind === "section" && row.title === "BODY") inBody = true;
    else if (row.kind === "section") inBody = false;
    else if (inBody && row.kind === "block" && row.bodyShapingChartRows) {
      for (const cr of row.bodyShapingChartRows) out.push(cr.rc);
    }
  }
  return out;
}

const BACK_CROSS_REFERENCE_PATTERNS: RegExp[] = [
  /same sequence as the back/i,
  /follows the same sequence/i,
  /\bFront follows\b/i,
  /refer (?:back )?to (?:the )?back/i,
  /follow the same schedule as the back/i,
];

describe("sleeveless front is linear and self-contained", () => {
  for (const [label, pattern] of [
    ["A-line pullover", alinePullover()],
    ["A-line cardigan", alineCardigan()],
  ] as const) {
    describe(label, () => {
      const r = generateSleevelessBackPattern(pattern);
      const frontParas = collectParagraphs(r.frontDisplayRows);
      const frontText = frontParas.join("\n");

      it("front intro never refers the knitter back to the BACK section", () => {
        for (const re of BACK_CROSS_REFERENCE_PATTERNS) {
          expect(frontText).not.toMatch(re);
        }
      });

      it("keeps the Armhole RC after-reset note intact on cardigan half-fronts only", () => {
        // Pullover fronts intentionally omit the intro block; cardigan half-fronts keep it.
        const expectNote = label === "A-line cardigan";
        expect(
          frontParas.some((p) => p.includes("After the armhole reset, use Armhole RC"))
        ).toBe(expectNote);
      });

      it("writes explicit front armhole shaping rows", () => {
        const armhole = armholeSectionParagraphs(r.frontDisplayRows);
        expect(armhole.length).toBeGreaterThan(0);
        expect(
          armhole.some((p) => /bind off OR hold \d+ stitches at the armhole edge/i.test(p))
        ).toBe(true);
      });

      it("writes explicit front body shaping rows mirroring the back", () => {
        const backRcs = bodyShapingChartRcs(r.displayRows);
        const frontRcs = bodyShapingChartRcs(r.frontDisplayRows);
        expect(backRcs.length).toBeGreaterThan(0);
        expect(frontRcs).toEqual(backRcs);
      });

      it("stops front shared rows before the FRONT NECKLINE & SHOULDERS section", () => {
        const titles = r.frontDisplayRows
          .filter((row): row is Extract<SleevelessPatternDisplayRow, { kind: "section" }> =>
            row.kind === "section"
          )
          .map((row) => row.title);
        expect(titles).toContain("FRONT NECKLINE & SHOULDERS");
        expect(titles).not.toContain("BACK NECKLINE & SHOULDERS");
      });
    });
  }

  it("cardigan front body shaping is worked only on the armhole edge (not both sides)", () => {
    const r = generateSleevelessBackPattern(alineCardigan());
    let inBody = false;
    const actions: string[] = [];
    for (const row of r.frontDisplayRows) {
      if (row.kind === "section" && row.title === "BODY") inBody = true;
      else if (row.kind === "section") inBody = false;
      else if (inBody && row.kind === "block" && row.bodyShapingChartRows) {
        for (const cr of row.bodyShapingChartRows) actions.push(cr.action);
      }
    }
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((a) => /at armhole edge/i.test(a))).toBe(true);
    expect(actions.some((a) => /each side edge/i.test(a))).toBe(false);
  });
});
