import { describe, expect, it } from "vitest";
import {
  BUST_DART_STYLE_KEY,
  buildBustDartPatternContext,
  isPatternEligibleForBustDartAction,
  previewBustDartForPattern,
  writeBustDartConfigToWorkingDraft,
} from "./bustDartPatternCustomization";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";

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
    expect(off.frontDisplayRows.flatMap((r) => (r.kind === "block" ? r.paragraphs : [])).join("\n")).not.toMatch(
      /bust dart/i,
    );

    const withDart = generateSleevelessBackPattern({
      ...base,
      style: { ...base.style, [BUST_DART_STYLE_KEY]: { enabled: true, cupSize: "C" } },
    });
    const front = withDart.frontDisplayRows
      .flatMap((r) => (r.kind === "block" ? r.paragraphs ?? [] : []))
      .join("\n");
    const back = withDart.displayRows
      .flatMap((r) => (r.kind === "block" ? r.paragraphs ?? [] : []))
      .join("\n");
    expect(front).toMatch(/Add bust darts \(cup C\)/i);
    expect(back).not.toMatch(/bust dart/i);
  });

  it("removing dart config restores no-dart front instructions", () => {
    const base = womenSleevelessPattern({
      [BUST_DART_STYLE_KEY]: { enabled: true, cupSize: "B" },
    });
    const withDart = generateSleevelessBackPattern(base);
    expect(
      withDart.frontDisplayRows.flatMap((r) => (r.kind === "block" ? r.paragraphs ?? [] : [])).join("\n"),
    ).toMatch(/bust dart/i);

    const removed = generateSleevelessBackPattern({
      ...base,
      style: { ...base.style, [BUST_DART_STYLE_KEY]: { enabled: false, cupSize: null } },
    });
    const legacy = generateSleevelessBackPattern(womenSleevelessPattern());
    expect(
      removed.frontDisplayRows.flatMap((r) => (r.kind === "block" ? r.paragraphs ?? [] : [])).join("\n"),
    ).toBe(
      legacy.frontDisplayRows.flatMap((r) => (r.kind === "block" ? r.paragraphs ?? [] : [])).join("\n"),
    );
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
    expect(
      gen.frontDisplayRows.flatMap((r) => (r.kind === "block" ? r.paragraphs ?? [] : [])).join("\n"),
    ).toMatch(/bust dart/i);
    expect(
      gen.sleeveDisplayRows.flatMap((r) => (r.kind === "block" ? r.paragraphs ?? [] : [])).join("\n"),
    ).not.toMatch(/bust dart/i);
  });

  it("writeBustDartConfigToWorkingDraft returns normalized config", () => {
    expect(writeBustDartConfigToWorkingDraft({ enabled: true, cupSize: "C" })).toEqual({
      enabled: true,
      cupSize: "C",
    });
    expect(writeBustDartConfigToWorkingDraft({ enabled: false, cupSize: "C" })).toEqual({
      enabled: false,
      cupSize: null,
    });
  });
});
