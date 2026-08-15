/**
 * Hat Pattern Builder math regression matrix.
 *
 * Invariants follow the current `calculateHatPattern` / draft / edit implementation.
 * Combinations cover every chart size, named length preset, brim type, and crown
 * along the distinct calculation paths — not UI-only permutations.
 */
import { describe, expect, it } from "vitest";
import hatSizingRows from "../../../data/sizing_hats.json";
import { HAT_GAUGE_IN_TO_CM_FACTOR } from "./hatBuilderGaugeUnits";
import { HAT_BUILDER_ALLOWED_CROWNS } from "./hatBuilderValidation";
import { buildHatSizingBuilderRows } from "./hatBuilderSizingLabels";
import { coerceHatDraft, createEmptyHatDraft, type HatDraft } from "./hatDraft";
import {
  applyHatCrownCastOnAdjustment,
  buildFourWedgeCrownSetup,
  buildFourWedgeDecreaseSchedule,
  calculateHatPattern,
  FOUR_GORE_DECREASE_ROW_FREQUENCY,
  gatheredCrownRemainingStitches,
  hatCrownStartRow,
  hatKnittedFinishedCircumferenceInches,
  hatProductionCastOnStitches,
  HAT_BRIM_TYPES,
  HAT_NAMED_FIT_STYLES,
  resolveNamedFitLengthInches,
  roundFinishedHatSizeFromHead,
  roundToEvenPreferUp,
  type HatBrimType,
  type HatNamedFitStyle,
  type HatPatternCalc,
  type HatSelectableNamedFitStyle,
} from "./hatMath";
import {
  applyHatEditFormToDraft,
  buildHatSummaryEditPreview,
  hatDraftToEditFormValues,
} from "./hatPatternEdit";
import {
  buildHatPatternCalcFromDraft,
  type HatSizingPatternRow,
} from "./hatPatternFromDraft";

const sizingRows = buildHatSizingBuilderRows(
  Array.isArray(hatSizingRows) ? hatSizingRows : [],
) as HatSizingPatternRow[];

const ALL_SIZES = sizingRows.map((row) => row.size);
const SMALLEST_SIZE = ALL_SIZES[0];
const LARGEST_SIZE = ALL_SIZES[ALL_SIZES.length - 1];

const PRIMARY_GAUGE = { stitch: "5", row: "7" };
const TIGHTER_GAUGE = { stitch: "7", row: "10" };
const DENSE_GAUGE = { stitch: "16", row: "24" };
const FOUR_GORE_GAUGES = [PRIMARY_GAUGE, TIGHTER_GAUGE, DENSE_GAUGE] as const;
const VISIBLE_BRIM_INCHES = 1;
const AMPLE_NEEDLES = "400";

type MatrixDraftArgs = {
  sizeSel: string;
  fit: string;
  brimType: HatBrimType;
  crown: string;
  stitch?: string;
  row?: string;
  brimLength?: string;
  customHatLength?: string;
  customCircumference?: string;
  unit?: "inches" | "cm";
};

function matrixDraft(args: MatrixDraftArgs): HatDraft {
  const unit = args.unit ?? "inches";
  const sizeSel = args.sizeSel;
  return createEmptyHatDraft({
    unit,
    sizeSel,
    customCircumference: args.customCircumference ?? "",
    brimType: args.brimType,
    brimLength: args.brimLength ?? String(VISIBLE_BRIM_INCHES),
    crownShaping: args.crown,
    fit: args.fit,
    customHatLength: args.customHatLength ?? "",
    availableNeedles: AMPLE_NEEDLES,
    gaugeSlots: {
      inches: {
        stitch: unit === "inches" ? (args.stitch ?? PRIMARY_GAUGE.stitch) : "",
        row: unit === "inches" ? (args.row ?? PRIMARY_GAUGE.row) : "",
      },
      cm: {
        stitch: unit === "cm" ? (args.stitch ?? "18") : "",
        row: unit === "cm" ? (args.row ?? "24") : "",
      },
    },
  });
}

function expectFiniteNumber(value: number, label: string): void {
  expect(Number.isFinite(value), `${label} must be finite (got ${value})`).toBe(true);
}

function expectNonNegative(value: number, label: string): void {
  expectFiniteNumber(value, label);
  expect(value, label).toBeGreaterThanOrEqual(0);
}

function expectPositiveInteger(value: number, label: string): void {
  expectFiniteNumber(value, label);
  expect(Number.isInteger(value), `${label} must be an integer`).toBe(true);
  expect(value, label).toBeGreaterThan(0);
}

function expectNonNegativeInteger(value: number, label: string): void {
  expectFiniteNumber(value, label);
  expect(Number.isInteger(value), `${label} must be an integer`).toBe(true);
  expect(value, label).toBeGreaterThanOrEqual(0);
}

/** Visible brim rows in the finished length (folded knits twice the fabric). */
function visibleBrimRows(calc: HatPatternCalc): number {
  return calc.brimType === "folded" ? calc.brimRows / 2 : calc.brimRows;
}

/**
 * Actual knitted rows that make the finished hat (visible brim + body + crown).
 * Brim and body use even-up, so the row sum may differ from hatHeight × gauge
 * by at most 2 rows.
 */
function actualKnittedRowCount(calc: HatPatternCalc): number {
  return visibleBrimRows(calc) + calc.bodyRows + calc.crownRowCount;
}

const KNITTED_ROW_ROUNDING_TOLERANCE_PER_EVEN_UP_SECTION = 1.5;

function evenUppedSectionCount(calc: HatPatternCalc): number {
  const crownFromSchedule =
    calc.crown === "spiral" ||
    calc.crown === "wedge-4-decrease" ||
    calc.crown === "wedge-4";
  // Brim and body always even-up; gathered crown even-ups chart depth to rows.
  return 2 + (crownFromSchedule ? 0 : 1);
}

function expectKnittedLengthWithinRounding(calc: HatPatternCalc, label: string): void {
  const knitted = actualKnittedRowCount(calc);
  const expected = calc.hatHeight * calc.rowGaugePerInch;
  const bound = evenUppedSectionCount(calc) * KNITTED_ROW_ROUNDING_TOLERANCE_PER_EVEN_UP_SECTION;
  expect(
    Math.abs(knitted - expected),
    `${label} knitted rows ${knitted} vs ${expected.toFixed(2)} expected`,
  ).toBeLessThanOrEqual(bound + 1e-9);
}

/** Length identity used by calculateHatPattern when brim + crown fit in the total. */
function expectLengthIdentity(calc: HatPatternCalc, label: string): void {
  const room = calc.hatHeight - calc.crownHeightInches - calc.brimDepth;
  if (room >= -1e-9) {
    expect(
      calc.bodyHeightInches + calc.crownHeightInches + calc.brimDepth,
      label,
    ).toBeCloseTo(calc.hatHeight, 5);
    expect(calc.bodyHeightInches, `${label} body`).toBeCloseTo(Math.max(0, room), 5);
  } else {
    expect(calc.bodyHeightInches, `${label} clamped body`).toBe(0);
  }
  expectKnittedLengthWithinRounding(calc, `${label} knitted length`);
}

function assertCalcInvariants(calc: HatPatternCalc, label: string): void {
  expectNonNegative(calc.targetWidth, `${label} targetWidth`);
  expect(calc.targetWidth, `${label} finished circ`).toBeGreaterThan(0);
  expectPositiveInteger(calc.castOnSts, `${label} castOnSts`);
  expect(calc.castOnSts % 2, `${label} cast-on even-up`).toBe(0);
  expectNonNegative(calc.hatHeight, `${label} hatHeight`);
  expect(calc.hatHeight, `${label} hatHeight`).toBeGreaterThan(0);
  expectNonNegative(calc.brimDepth, `${label} brimDepth`);
  expect(calc.brimDepth, `${label} brimDepth`).toBeGreaterThan(0);
  expectNonNegativeInteger(calc.brimRows, `${label} brimRows`);
  expect(calc.brimRows, `${label} brimRows`).toBeGreaterThan(0);
  expectNonNegativeInteger(calc.bodyRows, `${label} bodyRows`);
  expectNonNegativeInteger(calc.crownRowCount, `${label} crownRowCount`);
  expectNonNegative(calc.bodyHeightInches, `${label} bodyHeightInches`);
  expectNonNegative(calc.crownHeightInches, `${label} crownHeightInches`);
  expectFiniteNumber(calc.stGaugePerInch, `${label} stGaugePerInch`);
  expectFiniteNumber(calc.rowGaugePerInch, `${label} rowGaugePerInch`);
  expect(calc.stGaugePerInch, `${label} stGaugePerInch`).toBeGreaterThan(0);
  expect(calc.rowGaugePerInch, `${label} rowGaugePerInch`).toBeGreaterThan(0);
  expectLengthIdentity(calc, `${label} length identity`);

  const patternCastOn = applyHatCrownCastOnAdjustment(calc.castOnSts, calc.crown);
  expectPositiveInteger(patternCastOn, `${label} patternCastOn`);
  expect(
    Math.abs(patternCastOn - calc.castOnSts),
    `${label} crown cast-on adjustment`,
  ).toBeLessThanOrEqual(4);
  expect(hatProductionCastOnStitches(calc), `${label} production cast-on`).toBe(
    patternCastOn,
  );
  const knittedCirc = hatKnittedFinishedCircumferenceInches(calc);
  expectFiniteNumber(knittedCirc, `${label} knitted circumference`);
  if (patternCastOn !== calc.castOnSts) {
    expect(knittedCirc, `${label} adjusted circ from stitches`).toBeCloseTo(
      patternCastOn / calc.stGaugePerInch,
      10,
    );
  } else {
    expect(knittedCirc, `${label} unadjusted circ is size target`).toBe(calc.targetWidth);
  }

  if (calc.crown === "gathered") {
    expect(patternCastOn % 2, `${label} gathered even`).toBe(0);
    const remaining = gatheredCrownRemainingStitches(patternCastOn);
    expectPositiveInteger(remaining, `${label} gathered remaining`);
    expect(remaining, `${label} gathered remaining <= start`).toBeLessThanOrEqual(patternCastOn);
    expect(remaining, `${label} gathered remaining`).toBe(patternCastOn / 2);
  }

  if (calc.crown === "spiral") {
    expect(patternCastOn % 6, `${label} spiral ÷6`).toBe(0);
    expect(patternCastOn, `${label} spiral start`).toBeGreaterThanOrEqual(6);
    const target = calc.crownPlan.spiral?.targetStitches ?? 6;
    expect(target, `${label} spiral target`).toBe(6);
    expect(target, `${label} spiral target <= start`).toBeLessThanOrEqual(patternCastOn);
    expectNonNegativeInteger(calc.crownPlan.spiral?.decreaseRows ?? -1, `${label} spiral decreases`);
  }

  if (calc.crown === "wedge-4-decrease") {
    expect(patternCastOn % 4, `${label} four-gore ÷4`).toBe(0);
    const setup = buildFourWedgeCrownSetup({
      castOnSts: calc.castOnSts,
      crown: calc.crown,
      brimRows: calc.brimRows,
      bodyRows: calc.bodyRows,
    });
    expect(setup, `${label} four-gore setup`).not.toBeNull();
    if (!setup) return;
    expect(setup.adjustedCastOnStitches).toBe(patternCastOn);
    expect(setup.wedgeStitchCount * 4).toBe(patternCastOn);
    expect(setup.wedgeNeedleRanges).toHaveLength(4);
    const schedule = buildFourWedgeDecreaseSchedule(setup.wedgeStitchCount);
    expect(schedule.rowFrequency, `${label} four-gore every row`).toBe(
      FOUR_GORE_DECREASE_ROW_FREQUENCY,
    );
    expect(schedule.rowFrequency).toBe(1);
    expectNonNegativeInteger(schedule.decreaseCount, `${label} four-gore decreases`);
    expect(calc.crownRowCount, `${label} four-gore crown rows = shaping rows`).toBe(
      schedule.decreaseCount,
    );
    expect(calc.crownRowCount, `${label} four-gore plan rows`).toBe(calc.crownPlan.crownRows);
    expect(calc.crownHeightInches, `${label} four-gore crown height`).toBeCloseTo(
      schedule.decreaseCount / calc.rowGaugePerInch,
      10,
    );
    expect(hatCrownStartRow(calc), `${label} four-gore crown RC`).toBe(
      calc.brimRows + calc.bodyRows,
    );
    expect(setup.crownStartRow, `${label} four-gore setup RC`).toBe(
      calc.brimRows + calc.bodyRows,
    );
    expect(calc.bodyRows, `${label} four-gore body even-up`).toBe(
      roundToEvenPreferUp(calc.bodyHeightInches * calc.rowGaugePerInch),
    );
    expectPositiveInteger(schedule.remainingStitchesTotal, `${label} four-gore remaining`);
    expect(schedule.remainingStitchesTotal, `${label} four-gore remaining <= start`).toBeLessThanOrEqual(
      patternCastOn,
    );
    expect(schedule.finalWedgeStitchCount * 4).toBe(schedule.remainingStitchesTotal);
    expect([1, 2]).toContain(schedule.finalWedgeStitchCount);
  }
}

function expectDraftCalcOk(draft: HatDraft, label: string) {
  const result = buildHatPatternCalcFromDraft(draft, sizingRows);
  expect(result.ok, `${label}: ${!result.ok ? result.message : ""}`).toBe(true);
  if (!result.ok) return null;
  assertCalcInvariants(result.calc, label);
  return result;
}

describe("hat math regression matrix", () => {
  it("loads every chart size used by the builder", () => {
    expect(ALL_SIZES.length).toBeGreaterThanOrEqual(12);
    expect(SMALLEST_SIZE).toBe("xs_preemie");
    expect(LARGEST_SIZE).toBe("adult_man");
  });

  it("finished circumference is head × 0.9 to nearest 0.5\" for every size", () => {
    for (const row of sizingRows) {
      const finished = roundFinishedHatSizeFromHead(row.circumference);
      expect(finished).toBe(row.finishedSizeInches);
      expect(finished).toBeGreaterThan(0);
      expect(finished).toBeLessThan(row.circumference);
      expect(finished * 2)
        .toBeCloseTo(Math.round(finished * 2), 8);
    }
  });

  it("named lengths increase Beanie → Standard → Slouchy and scale with size", () => {
    const smallest = { beanie: 0, watchcap: 0, slouchy: 0 } as Record<
      HatSelectableNamedFitStyle,
      number
    >;
    for (const size of ALL_SIZES) {
      const beanie = resolveNamedFitLengthInches("beanie", size, sizingRows)!;
      const standard = resolveNamedFitLengthInches("watchcap", size, sizingRows)!;
      const slouchy = resolveNamedFitLengthInches("slouchy", size, sizingRows)!;
      expect(beanie, `${size} beanie`).toBeGreaterThan(0);
      expect(standard, `${size} standard`).toBeGreaterThan(beanie);
      expect(slouchy, `${size} slouchy`).toBeGreaterThan(standard);
      expect(standard).toBe(Number(sizingRows.find((r) => r.size === size)?.hatLength));
      if (size === SMALLEST_SIZE) {
        smallest.beanie = beanie;
        smallest.watchcap = standard;
        smallest.slouchy = slouchy;
      }
      if (size === LARGEST_SIZE) {
        expect(beanie).toBeGreaterThan(smallest.beanie);
        expect(standard).toBeGreaterThan(smallest.watchcap);
        expect(slouchy).toBeGreaterThan(smallest.slouchy);
      }
    }
  });

  it("covers every size × named length × brim × crown at the primary gauge", () => {
    let cases = 0;
    for (const sizeSel of ALL_SIZES) {
      const row = sizingRows.find((r) => r.size === sizeSel)!;
      for (const fit of HAT_NAMED_FIT_STYLES) {
        for (const brimType of HAT_BRIM_TYPES) {
          for (const crown of HAT_BUILDER_ALLOWED_CROWNS) {
            const label = `${sizeSel}/${fit}/${brimType}/${crown}`;
            const draft = matrixDraft({ sizeSel, fit, brimType, crown });
            const result = expectDraftCalcOk(draft, label);
            if (!result) continue;
            cases += 1;
            expect(result.calc.hatHeight).toBe(
              resolveNamedFitLengthInches(fit, sizeSel, sizingRows),
            );
            expect(result.calc.targetWidth).toBe(row.finishedSizeInches);
            expect(result.calc.brimType).toBe(brimType);
            expect(result.calc.brimDepth).toBe(VISIBLE_BRIM_INCHES);
            expect(result.calc.fit).toBe(fit);

            const reopened = coerceHatDraft(JSON.parse(JSON.stringify(draft)));
            const again = expectDraftCalcOk(reopened!, `${label} reopened`);
            if (!again) continue;
            expect(again.calc.hatHeight).toBe(result.calc.hatHeight);
            expect(again.calc.castOnSts).toBe(result.calc.castOnSts);
            expect(again.calc.bodyRows).toBe(result.calc.bodyRows);
            expect(again.calc.brimRows).toBe(result.calc.brimRows);
            expect(again.calc.crownRowCount).toBe(result.calc.crownRowCount);
            expect(again.calc.bodyHeightInches).toBe(result.calc.bodyHeightInches);
          }
        }
      }
    }
    expect(cases).toBe(
      ALL_SIZES.length *
        HAT_NAMED_FIT_STYLES.length *
        HAT_BRIM_TYPES.length *
        HAT_BUILDER_ALLOWED_CROWNS.length,
    );
  });

  it("rolled and single share body math; folded doubles brim rows only", () => {
    for (const sizeSel of [SMALLEST_SIZE, "child", "adult_woman", LARGEST_SIZE]) {
      for (const fit of HAT_NAMED_FIT_STYLES) {
        for (const crown of HAT_BUILDER_ALLOWED_CROWNS) {
          const rolled = expectDraftCalcOk(
            matrixDraft({ sizeSel, fit, brimType: "rolled", crown }),
            `${sizeSel}/${fit}/${crown} rolled`,
          );
          const single = expectDraftCalcOk(
            matrixDraft({ sizeSel, fit, brimType: "single", crown }),
            `${sizeSel}/${fit}/${crown} single`,
          );
          const folded = expectDraftCalcOk(
            matrixDraft({ sizeSel, fit, brimType: "folded", crown }),
            `${sizeSel}/${fit}/${crown} folded`,
          );
          if (!rolled || !single || !folded) continue;
          expect(rolled.calc.bodyHeightInches).toBe(single.calc.bodyHeightInches);
          expect(rolled.calc.bodyRows).toBe(single.calc.bodyRows);
          expect(rolled.calc.brimRows).toBe(single.calc.brimRows);
          expect(rolled.calc.hatHeight).toBe(single.calc.hatHeight);
          expect(folded.calc.hatHeight).toBe(single.calc.hatHeight);
          expect(folded.calc.bodyHeightInches).toBe(single.calc.bodyHeightInches);
          expect(folded.calc.bodyRows).toBe(single.calc.bodyRows);
          expect(folded.calc.brimRows).toBe(single.calc.brimRows * 2);
        }
      }
    }
  });

  it("changing named length preset recalculates dependent values for every size", () => {
    for (const sizeSel of ALL_SIZES) {
      const beanie = expectDraftCalcOk(
        matrixDraft({ sizeSel, fit: "beanie", brimType: "single", crown: "gathered" }),
        `${sizeSel} beanie`,
      );
      const standard = expectDraftCalcOk(
        matrixDraft({ sizeSel, fit: "watchcap", brimType: "single", crown: "gathered" }),
        `${sizeSel} standard`,
      );
      const slouchy = expectDraftCalcOk(
        matrixDraft({ sizeSel, fit: "slouchy", brimType: "single", crown: "gathered" }),
        `${sizeSel} slouchy`,
      );
      if (!beanie || !standard || !slouchy) continue;
      expect(standard.calc.hatHeight).toBeGreaterThan(beanie.calc.hatHeight);
      expect(slouchy.calc.hatHeight).toBeGreaterThan(standard.calc.hatHeight);
      expect(standard.calc.bodyHeightInches).toBeGreaterThan(beanie.calc.bodyHeightInches);
      expect(slouchy.calc.bodyHeightInches).toBeGreaterThan(standard.calc.bodyHeightInches);
      expect(beanie.calc.targetWidth).toBe(standard.calc.targetWidth);
      expect(slouchy.calc.targetWidth).toBe(standard.calc.targetWidth);
      expect(beanie.calc.castOnSts).toBe(standard.calc.castOnSts);
    }
  });

  it("changing size with the same named preset does not keep the previous size’s length", () => {
    for (const fit of HAT_NAMED_FIT_STYLES) {
      const small = expectDraftCalcOk(
        matrixDraft({
          sizeSel: SMALLEST_SIZE,
          fit,
          brimType: "single",
          crown: "gathered",
        }),
        `${SMALLEST_SIZE}/${fit}`,
      );
      const large = expectDraftCalcOk(
        matrixDraft({
          sizeSel: LARGEST_SIZE,
          fit,
          brimType: "single",
          crown: "gathered",
        }),
        `${LARGEST_SIZE}/${fit}`,
      );
      if (!small || !large) continue;
      expect(large.calc.hatHeight).toBeGreaterThan(small.calc.hatHeight);
      expect(large.calc.targetWidth).toBeGreaterThan(small.calc.targetWidth);
      expect(large.calc.castOnSts).toBeGreaterThan(small.calc.castOnSts);

      const saved = matrixDraft({
        sizeSel: LARGEST_SIZE,
        fit,
        brimType: "single",
        crown: "gathered",
      });
      const smallForm = hatDraftToEditFormValues(
        matrixDraft({
          sizeSel: SMALLEST_SIZE,
          fit,
          brimType: "single",
          crown: "gathered",
        }),
        sizingRows,
      );
      const preview = buildHatSummaryEditPreview(saved, smallForm, sizingRows);
      expect(preview.ok, `${fit} size change`).toBe(true);
      if (!preview.ok) continue;
      expect(preview.draft.fit).toBe(fit);
      expect(preview.calc.hatHeight).toBe(small.calc.hatHeight);
      expect(preview.calc.hatHeight).not.toBe(large.calc.hatHeight);
    }
  });

  it("edit mode preserves named selections and recalculates when the preset changes", () => {
    for (const sizeSel of ALL_SIZES) {
      for (const fit of HAT_NAMED_FIT_STYLES) {
        const draft = matrixDraft({
          sizeSel,
          fit,
          brimType: "rolled",
          crown: "wedge-4-decrease",
        });
        const form = hatDraftToEditFormValues(draft, sizingRows);
        expect(form.fit).toBe(fit);
        const applied = applyHatEditFormToDraft(draft, form, sizingRows);
        expect(applied.fit).toBe(fit);
        expect(applied.customHatLength).toBe("");
        const preview = buildHatSummaryEditPreview(draft, form, sizingRows);
        expect(preview.ok, `${sizeSel}/${fit} edit`).toBe(true);
        if (!preview.ok) continue;
        const fromDraft = buildHatPatternCalcFromDraft(draft, sizingRows);
        expect(fromDraft.ok).toBe(true);
        if (!fromDraft.ok) continue;
        expect(preview.calc.hatHeight).toBe(fromDraft.calc.hatHeight);
        expect(preview.calc.castOnSts).toBe(fromDraft.calc.castOnSts);
        expect(preview.calc.bodyRows).toBe(fromDraft.calc.bodyRows);
        expect(preview.calc.crownRowCount).toBe(fromDraft.calc.crownRowCount);
        expect(form.finishedHatLength).toBe(String(fromDraft.calc.hatHeight));

        const nextFit: HatNamedFitStyle = fit === "slouchy" ? "beanie" : "slouchy";
        const nextLength = resolveNamedFitLengthInches(nextFit, sizeSel, sizingRows)!;
        const switched = buildHatSummaryEditPreview(
          draft,
          { ...form, fit: nextFit, finishedHatLength: String(nextLength) },
          sizingRows,
        );
        expect(switched.ok, `${sizeSel} ${fit}→${nextFit}`).toBe(true);
        if (!switched.ok) continue;
        expect(switched.draft.fit).toBe(nextFit);
        expect(switched.calc.hatHeight).toBe(nextLength);
        expect(switched.calc.hatHeight).not.toBe(preview.calc.hatHeight);
        expect(switched.calc.crownRowCount).toBe(preview.calc.crownRowCount);
        expect(switched.calc.bodyHeightInches).not.toBe(preview.calc.bodyHeightInches);
      }
    }
  });

  it("custom finished length stays valid and does not inherit a named preset length", () => {
    const shorts = [3, 4.5];
    const longs = [14, 16];
    for (const sizeSel of [SMALLEST_SIZE, "child", "adult_woman", LARGEST_SIZE]) {
      for (const custom of [...shorts, ...longs]) {
        const draft = matrixDraft({
          sizeSel,
          fit: "custom",
          brimType: "single",
          crown: "gathered",
          customHatLength: String(custom),
        });
        const result = expectDraftCalcOk(draft, `${sizeSel} custom ${custom}`);
        if (!result) continue;
        expect(result.calc.hatHeight).toBe(custom);
        expect(result.calc.hatHeight).not.toBe(
          resolveNamedFitLengthInches("watchcap", sizeSel, sizingRows),
        );
        const form = hatDraftToEditFormValues(draft, sizingRows);
        expect(form.fit).toBe("custom");
        expect(form.finishedHatLength).toBe(String(custom));
        const preview = buildHatSummaryEditPreview(draft, form, sizingRows);
        expect(preview.ok).toBe(true);
        if (!preview.ok) continue;
        expect(preview.draft.fit).toBe("custom");
        expect(preview.calc.hatHeight).toBe(custom);
      }
    }
  });

  it("custom circumference uses the entered size instead of a chart row", () => {
    const draft = matrixDraft({
      sizeSel: "custom",
      fit: "watchcap",
      brimType: "single",
      crown: "gathered",
      customCircumference: "20",
    });
    const result = expectDraftCalcOk(draft, "custom circ");
    expect(result?.calc.targetWidth).toBe(20);
    expect(result?.calc.hatHeight).toBe(
      resolveNamedFitLengthInches("watchcap", "custom", sizingRows),
    );
  });

  it("tighter gauge at size/length extremes still produces valid stitch math", () => {
    for (const sizeSel of [SMALLEST_SIZE, LARGEST_SIZE]) {
      for (const fit of ["beanie", "slouchy"] as const) {
        for (const brimType of HAT_BRIM_TYPES) {
          for (const crown of HAT_BUILDER_ALLOWED_CROWNS) {
            const result = expectDraftCalcOk(
              matrixDraft({
                sizeSel,
                fit,
                brimType,
                crown,
                stitch: TIGHTER_GAUGE.stitch,
                row: TIGHTER_GAUGE.row,
              }),
              `${sizeSel}/${fit}/${brimType}/${crown} 7x10`,
            );
            if (!result) continue;
            const loose = expectDraftCalcOk(
              matrixDraft({ sizeSel, fit, brimType, crown }),
              `${sizeSel}/${fit} 5x7`,
            );
            if (!loose) continue;
            expect(result.calc.castOnSts).toBeGreaterThan(loose.calc.castOnSts);
          }
        }
      }
    }
  });

  it("metric drafts convert gauge and custom length back to the same inch math", () => {
    const inchDraft = matrixDraft({
      sizeSel: "adult_woman",
      fit: "custom",
      brimType: "rolled",
      crown: "spiral",
      customHatLength: "11",
    });
    const cmDraft = matrixDraft({
      sizeSel: "adult_woman",
      fit: "custom",
      brimType: "rolled",
      crown: "spiral",
      unit: "cm",
      brimLength: "2.5",
      customHatLength: String(Math.round(11 * 2.54 * 10) / 10),
      stitch: (5 * HAT_GAUGE_IN_TO_CM_FACTOR).toFixed(1),
      row: (7 * HAT_GAUGE_IN_TO_CM_FACTOR).toFixed(1),
    });
    const inches = expectDraftCalcOk(inchDraft, "inch custom 11");
    const cm = expectDraftCalcOk(cmDraft, "cm custom 11");
    expect(inches && cm).toBeTruthy();
    if (!inches || !cm) return;
    expect(cm.calc.hatHeight).toBeCloseTo(inches.calc.hatHeight, 1);
    // Rolled default in cm is "2.5" (1" × 2.54, one decimal). Converted back with /2.54, not 1".
    expect(cm.calc.brimDepth).toBeCloseTo(2.5 / 2.54, 5);
    expect(cm.calc.brimDepth).toBeGreaterThan(0);
  });

  it("smallest Beanie / largest Slouchy with rolled brim stay mathematically possible", () => {
    for (const spec of [
      { sizeSel: SMALLEST_SIZE, fit: "beanie" as const },
      { sizeSel: SMALLEST_SIZE, fit: "slouchy" as const },
      { sizeSel: LARGEST_SIZE, fit: "beanie" as const },
      { sizeSel: LARGEST_SIZE, fit: "slouchy" as const },
    ]) {
      for (const crown of HAT_BUILDER_ALLOWED_CROWNS) {
        const result = expectDraftCalcOk(
          matrixDraft({
            sizeSel: spec.sizeSel,
            fit: spec.fit,
            brimType: "rolled",
            crown,
          }),
          `${spec.sizeSel}/${spec.fit}/rolled/${crown}`,
        );
        expect(result).not.toBeNull();
      }
    }
  });

  it("Pre-Teen 16×24 Beanie Four-Gore uses 9 shaping rows and 1.5\" crown", () => {
    const draft = matrixDraft({
      sizeSel: "preteen",
      fit: "beanie",
      brimType: "single",
      crown: "wedge-4-decrease",
      stitch: DENSE_GAUGE.stitch,
      row: DENSE_GAUGE.row,
      brimLength: "2",
    });
    const result = expectDraftCalcOk(draft, "preteen 16×24 beanie four-gore");
    expect(result).not.toBeNull();
    if (!result) return;
    const { calc } = result;
    expect(calc.hatHeight).toBe(8.2);
    expect(calc.targetWidth).toBe(19);
    expect(calc.castOnSts).toBe(76);
    expect(calc.brimRows).toBe(12);
    expect(calc.crownRowCount).toBe(9);
    expect(calc.crownHeightInches).toBeCloseTo(1.5, 10);
    expect(calc.bodyHeightInches).toBeCloseTo(4.7, 10);
    expect(calc.bodyRows).toBe(28);
    expect(hatCrownStartRow(calc)).toBe(40);
    expect(actualKnittedRowCount(calc)).toBe(12 + 28 + 9);

    const reopened = coerceHatDraft(JSON.parse(JSON.stringify(draft)));
    const again = expectDraftCalcOk(reopened!, "preteen 16×24 reopened");
    expect(again?.calc.crownRowCount).toBe(9);
    expect(again?.calc.bodyRows).toBe(28);

    const form = hatDraftToEditFormValues(draft, sizingRows);
    const preview = buildHatSummaryEditPreview(draft, form, sizingRows);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.calc.crownRowCount).toBe(9);
    expect(preview.calc.bodyRows).toBe(28);
    expect(preview.calc.hatHeight).toBe(8.2);
  });

  it("Four-Gore crown rows follow the shaping sequence at every size, named length, and gauge", () => {
    let cases = 0;
    for (const gauge of FOUR_GORE_GAUGES) {
      for (const sizeSel of ALL_SIZES) {
        for (const fit of HAT_NAMED_FIT_STYLES) {
          const label = `${sizeSel}/${fit}/${gauge.stitch}x${gauge.row} four-gore`;
          const result = expectDraftCalcOk(
            matrixDraft({
              sizeSel,
              fit,
              brimType: "single",
              crown: "wedge-4-decrease",
              stitch: gauge.stitch,
              row: gauge.row,
              brimLength: "2",
            }),
            label,
          );
          if (!result) continue;
          cases += 1;
          const { calc } = result;
          const setup = buildFourWedgeCrownSetup({
            castOnSts: calc.castOnSts,
            crown: calc.crown,
            brimRows: calc.brimRows,
            bodyRows: calc.bodyRows,
          })!;
          const schedule = buildFourWedgeDecreaseSchedule(setup.wedgeStitchCount);
          expect(calc.crownRowCount).toBe(schedule.decreaseCount);
          expect(calc.crownHeightInches).toBeCloseTo(
            schedule.decreaseCount / calc.rowGaugePerInch,
            10,
          );
          expect(hatCrownStartRow(calc)).toBe(calc.brimRows + calc.bodyRows);
        }
      }
    }
    expect(cases).toBe(FOUR_GORE_GAUGES.length * ALL_SIZES.length * HAT_NAMED_FIT_STYLES.length);
  });

  it("Four-Gore crown rows ignore chart suggestedCrownDepth", () => {
    const base = {
      finishedHatCircInches: 19,
      stitchGaugeDisplay: 16,
      rowGaugeDisplay: 24,
      displayUnit: "inches" as const,
      totalHatLengthInches: 8.2,
      brimDepthInches: 2,
      brimType: "single" as const,
      crown: "wedge-4-decrease",
      fit: "beanie",
    };
    const chart = calculateHatPattern({ ...base, suggestedCrownDepthInches: 2 });
    const deeper = calculateHatPattern({ ...base, suggestedCrownDepthInches: 4 });
    expect(chart.crownRowCount).toBe(9);
    expect(deeper.crownRowCount).toBe(chart.crownRowCount);
    expect(deeper.crownHeightInches).toBe(chart.crownHeightInches);
    expect(deeper.bodyRows).toBe(chart.bodyRows);
  });
});
