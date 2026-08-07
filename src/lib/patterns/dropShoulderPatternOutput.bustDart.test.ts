import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";
import { BUST_DART_STYLE_KEY } from "./legoBlocks/bustDart";
import { inchesToRows } from "./sleevelessRowAccounting";

function womenBase(styleExtra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedSize: "1",
      selectedMeasurements: {
        finished_bust_chest: 36,
        back_neck_to_hem: 22,
        armhole_depth: 7,
        shoulder_width: 12,
        neck_opening: 6,
        front_neck_depth: 4,
        back_neck_depth: 1,
        upper_arm: 12,
        wrist: 6,
        sleeve_length: 17,
      },
    },
    style: {
      construction: "drop-shoulder",
      constructionAuthored: "drop-shoulder",
      recipientCategory: "misses",
      neckline: "round",
      bodyShape: "straight",
      frontStyle: "closed",
      garmentStyle: "pullover",
      sleeveLength: "long",
      ...styleExtra,
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function allParagraphs(rows: readonly SleevelessPatternDisplayRow[]): string[] {
  return rows.flatMap((row) => {
    if (row.kind === "bustDartCustomization") return row.instructionParagraphs ?? [];
    if (row.kind !== "block") return [];
    return [...(row.paragraphs ?? []), ...(row.trustedParagraphs ?? [])];
  });
}

describe("drop-shoulder bust darts integration", () => {
  it("women’s pullover with darts: front includes dart; back and sleeves do not", () => {
    const r = generateDropShoulderPattern(
      womenBase({ [BUST_DART_STYLE_KEY]: { enabled: true, cupSize: "C" } }),
    );

    const front = allParagraphs(r.frontDisplayRows).join("\n");
    const back = allParagraphs(r.displayRows).join("\n");
    const sleeves = allParagraphs(r.sleeveDisplayRows).join("\n");

    expect(front).toMatch(/Work the short-row bust darts, Cup C\./i);
    expect(front).toMatch(/On each side of the Front center/i);
    expect(front).toMatch(/place \d+ needles in hold/i);
    expect(front).not.toMatch(/back or sleeves/i);
    expect(back).not.toMatch(/bust dart/i);
    expect(sleeves).not.toMatch(/bust dart/i);

    const armholeRc = r.debug.armholeStartRow ?? r.debug.rowsFromCastOnToArmholeStart;
    const offset = inchesToRows(1, 7);
    expect(front).toContain(`RC ${armholeRc - offset}`);
  });

  it("women’s cardigan with darts includes mirrored right-front note", () => {
    const r = generateDropShoulderPattern(
      womenBase({
        frontStyle: "open",
        garmentStyle: "cardigan",
        [BUST_DART_STYLE_KEY]: { enabled: true, cupSize: "D" },
      }),
    );
    const front = allParagraphs(r.frontDisplayRows).join("\n");
    expect(front).toMatch(/Work the short-row bust darts, Cup D\./i);
    expect(front).toMatch(/From the side \(armhole\) edge toward the Front center/i);
    expect(front).toMatch(/RIGHT FRONT/i);
    expect(front).toMatch(/bust-dart|bust dart/i);
  });

  it("darts off: eligible Front still splits at dart RC without dart knitting prose", () => {
    const off = generateDropShoulderPattern(
      womenBase({ [BUST_DART_STYLE_KEY]: { enabled: false, cupSize: null } }),
    );
    const legacy = generateDropShoulderPattern(womenBase());
    expect(allParagraphs(off.frontDisplayRows).join("\n")).not.toMatch(/Add bust darts/i);
    expect(allParagraphs(legacy.frontDisplayRows).join("\n")).not.toMatch(/Add bust darts/i);
    const offSlot = off.frontDisplayRows.find((r) => r.kind === "bustDartCustomization");
    const legacySlot = legacy.frontDisplayRows.find((r) => r.kind === "bustDartCustomization");
    expect(offSlot?.kind).toBe("bustDartCustomization");
    expect(legacySlot?.kind).toBe("bustDartCustomization");
  });

  it("kids pattern does not generate bust darts", () => {
    const r = generateDropShoulderPattern({
      ...womenBase({
        recipientCategory: "kids",
        [BUST_DART_STYLE_KEY]: { enabled: true, cupSize: "C" },
      }),
      fit: {
        sizingChart: "kids",
        selectedMeasurements: {
          finished_bust_chest: 24,
          back_neck_to_hem: 18,
          armhole_depth: 4.25,
          shoulder_width: 9.25,
          neck_opening: 4,
          front_neck_depth: 2,
          back_neck_depth: 1,
          upper_arm: 6,
          wrist: 4.5,
          sleeve_length: 8.5,
        },
      },
    });
    expect(allParagraphs(r.frontDisplayRows).join("\n")).not.toMatch(/bust dart/i);
  });
});
