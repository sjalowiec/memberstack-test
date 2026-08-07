import { describe, expect, it } from "vitest";
import {
  BUST_DART_STYLE_KEY,
  buildBustDartPatternContext,
  isPatternEligibleForBustDartAction,
  previewBustDartForPattern,
  writeBustDartConfigToWorkingDraft,
} from "./bustDartPatternCustomization";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";

function frontInstructionText(rows: readonly SleevelessPatternDisplayRow[]): string {
  return rows
    .flatMap((r) => {
      if (r.kind === "bustDartCustomization") return r.instructionParagraphs ?? [];
      if (r.kind === "block") return r.paragraphs ?? [];
      return [];
    })
    .join("\n");
}

function womenSleevelessPattern(extraStyle: Record<string, unknown> = {}): Record<string, unknown> {
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
      neckline: "round",
      frontStyle: "closed",
      garmentStyle: "pullover",
      ...extraStyle,
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
      gaugeRawUnit: "in",
    },
  };
}

describe("bust dart post-build customization", () => {
  it("eligible women’s patterns expose the action; men do not", () => {
    expect(isPatternEligibleForBustDartAction(womenSleevelessPattern())).toBe(true);
    const women = womenSleevelessPattern();
    expect(
      isPatternEligibleForBustDartAction({
        ...women,
        fit: {
          sizingChart: "men",
          selectedMeasurements: (women.fit as Record<string, unknown>).selectedMeasurements,
        },
        style: { recipientCategory: "men", neckline: "round", frontStyle: "closed" },
      }),
    ).toBe(false);
  });

  it("prefills gauge, construction, and placement from the pattern", () => {
    const ctx = buildBustDartPatternContext(womenSleevelessPattern());
    expect(ctx.eligible).toBe(true);
    expect(ctx.frontConstruction).toBe("pullover");
    expect(ctx.stitchesPerInch).toBe(5);
    expect(ctx.rowsPerInch).toBe(7);
    expect(ctx.armholeOpeningGarmentRc).toBeGreaterThan(ctx.hemRows);
    expect(ctx.bodyToArmholeRows).toBeGreaterThan(0);
    expect(ctx.summary.gaugeLabel).toMatch(/sts/);
    expect(ctx.summary.placementLabel).toMatch(/1″/);
  });

  it("preview uses shared lego math for cup C", () => {
    const ctx = buildBustDartPatternContext(womenSleevelessPattern());
    const preview = previewBustDartForPattern(ctx, "C");
    expect(preview.active).toBe(true);
    expect(preview.shaping?.totalHeldStitches).toBe(16);
    expect(preview.dartStartGarmentRc).toBe(ctx.armholeOpeningGarmentRc - 7);
  });

  it("importing cup size into style regenerates front darts only", () => {
    const base = womenSleevelessPattern();
    const off = generateSleevelessBackPattern(base);
    expect(frontInstructionText(off.frontDisplayRows)).not.toMatch(/Add bust darts/i);
    expect(off.frontDisplayRows.some((r) => r.kind === "bustDartCustomization")).toBe(true);

    const withDart = generateSleevelessBackPattern({
      ...base,
      style: { ...base.style, [BUST_DART_STYLE_KEY]: { enabled: true, cupSize: "C" } },
    });
    expect(frontInstructionText(withDart.frontDisplayRows)).toMatch(
      /Stop the row counter at RC \d+, 1″ below the armhole opening/i,
    );
    expect(frontInstructionText(withDart.displayRows)).not.toMatch(/bust dart/i);
    const slot = withDart.frontDisplayRows.find((r) => r.kind === "bustDartCustomization");
    expect(slot?.kind === "bustDartCustomization" && slot.active).toBe(true);
    expect(slot?.kind === "bustDartCustomization" && slot.cupSize).toBe("C");
  });

  it("removing dart config restores no-dart front instructions", () => {
    const base = womenSleevelessPattern({
      [BUST_DART_STYLE_KEY]: { enabled: true, cupSize: "B" },
    });
    const withDart = generateSleevelessBackPattern(base);
    expect(frontInstructionText(withDart.frontDisplayRows)).toMatch(
      /Stop the row counter at RC \d+, 1″ below the armhole opening/i,
    );
    const withSlot = withDart.frontDisplayRows.find((r) => r.kind === "bustDartCustomization");
    expect(withSlot?.kind === "bustDartCustomization" && withSlot.active).toBe(true);

    const removed = generateSleevelessBackPattern({
      ...base,
      style: { ...base.style, [BUST_DART_STYLE_KEY]: { enabled: false, cupSize: null } },
    });
    const legacy = generateSleevelessBackPattern(womenSleevelessPattern());
    expect(frontInstructionText(removed.frontDisplayRows)).not.toMatch(/Add bust darts/i);
    expect(frontInstructionText(legacy.frontDisplayRows)).not.toMatch(/Add bust darts/i);
    const removedSlot = removed.frontDisplayRows.find((r) => r.kind === "bustDartCustomization");
    expect(removedSlot?.kind === "bustDartCustomization" && removedSlot.active).toBe(false);
  });

  it("drop-shoulder cardigan preview is cardigan construction", () => {
    const pattern = {
      fit: {
        sizingChart: "misses",
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
        frontStyle: "open",
        garmentStyle: "cardigan",
        sleeveLength: "long",
      },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 5,
        gaugeRowsPerInch: 7,
        availableNeedles: 200,
      },
    };
    const ctx = buildBustDartPatternContext(pattern);
    expect(ctx.frontConstruction).toBe("cardigan");
    const preview = previewBustDartForPattern(ctx, "D");
    expect(preview.active).toBe(true);
    expect(preview.cardiganRightMirrorParagraph).toMatch(/RIGHT FRONT/i);

    const gen = generateDropShoulderPattern({
      ...pattern,
      style: { ...pattern.style, [BUST_DART_STYLE_KEY]: { enabled: true, cupSize: "D" } },
    });
    expect(frontInstructionText(gen.frontDisplayRows)).toMatch(/bust-dart short rows/i);
    expect(frontInstructionText(gen.frontDisplayRows)).toMatch(
      /From the side \(armhole\) edge toward the Front center/i,
    );
    expect(
      gen.sleeveDisplayRows.flatMap((r) => (r.kind === "block" ? r.paragraphs ?? [] : [])).join("\n"),
    ).not.toMatch(/bust dart/i);
  });

  it("writeBustDartConfigToWorkingDraft returns normalized config", () => {
    expect(
      writeBustDartConfigToWorkingDraft({
        enabled: true,
        cupSize: "C",
        dartWidthInches: null,
        dartDepthInches: null,
      }),
    ).toEqual({
      enabled: true,
      cupSize: "C",
      dartWidthInches: null,
      dartDepthInches: null,
    });
    expect(
      writeBustDartConfigToWorkingDraft({
        enabled: false,
        cupSize: "C",
        dartWidthInches: 3,
        dartDepthInches: 1,
      }),
    ).toEqual({
      enabled: false,
      cupSize: null,
      dartWidthInches: null,
      dartDepthInches: null,
    });
    expect(
      writeBustDartConfigToWorkingDraft({
        enabled: true,
        cupSize: "C",
        dartWidthInches: 3.5,
        dartDepthInches: 1.25,
      }),
    ).toEqual({
      enabled: true,
      cupSize: "C",
      dartWidthInches: 3.5,
      dartDepthInches: 1.25,
    });
  });
});
