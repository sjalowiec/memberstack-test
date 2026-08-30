import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SOCK_BUILDER_INCOMPLETE_MESSAGE,
  SOCK_BUILDER_STEPS,
  evaluateSockBuilderCalc,
  evaluateSockBuilderGaugeSanityGate,
  evaluateSockBuilderNeedleCapacity,
  isSockBuilderCtaEnabled,
  isSockBuilderConstructionComplete,
  isSockBuilderGaugeFieldsComplete,
  isSockBuilderInputComplete,
  isSockBuilderMeasurementsComplete,
  isSockBuilderReadyToReview,
  isSockBuilderSizeComplete,
  measurementsFromSockSize,
  nextSockBuilderOpenStepAfterFieldChange,
  resolveSockBuilderRequiredNeedles,
  snapshotFromSockDraft,
  sockBuilderChoiceFieldAdvances,
  sockBuilderStepComplete,
  type SockBuilderFieldSnapshot,
} from "./sockBuilderValidation";
import {
  convertSockMeasurementDisplay,
  draftUnitFromToggleDetail,
  formatSockMeasurementDisplay,
  maybeFillSockGaugeSlotFromOtherUnit,
  SOCK_GAUGE_IN_TO_CM_FACTOR,
} from "./sockBuilderUnits";
import {
  buildSockBuilderNewPatternHref,
  SOCK_BUILDER_PATH,
} from "./sockFreshStart";
import {
  buildSockNeedleCapacityMessage,
  resolveSockRequiredNeedles,
  validateSockNeedleCapacity,
} from "./sockAvailableNeedles";
import {
  createEmptySockDraft,
  readSockDraft,
  SOCK_DRAFT_STORAGE_KEY,
  writeSockDraft,
} from "./sockDraft";
import { calculateBasicSockPattern } from "./sockMath";
import { createSockSizingAdapter } from "./sockSizing";

const adapter = createSockSizingAdapter(
  JSON.parse(readFileSync(resolve("public/data/sizing_socks.json"), "utf8")),
);

const completeFields: SockBuilderFieldSnapshot = {
  sizeSel: "woman_med",
  constructionDirection: "cuff-to-toe",
  footCircumference: "8.5",
  footLength: "9",
  legCircumference: "8.5",
  legLength: "4.5",
  stitchGauge: "28",
  rowGauge: "40",
  availableNeedles: "200",
};

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

describe("sock builder size → default measurements", () => {
  it("populates finished chart measurements, using cuff_length as leg length and foot circ as leg circ", () => {
    const womanMed = measurementsFromSockSize("woman_med", adapter, "inches");
    expect(womanMed).toEqual({
      footCircumference: "8.5",
      footLength: "9",
      legCircumference: "8.5",
      legLength: "4.5",
    });
    expect(isSockBuilderSizeComplete({ sizeSel: "woman_med" }, adapter)).toBe(true);
    expect(isSockBuilderMeasurementsComplete(womanMed!)).toBe(true);

    const baby = measurementsFromSockSize("baby", adapter, "inches");
    expect(baby?.footCircumference).toBe(formatSockMeasurementDisplay(4, "inches"));
    expect(baby?.legCircumference).toBe(baby?.footCircumference);

    expect(measurementsFromSockSize("", adapter, "inches")).toBeNull();
    expect(isSockBuilderSizeComplete({ sizeSel: "" }, adapter)).toBe(false);
  });

  it("keeps Woman Large and Man Small distinct when they share foot circumference", () => {
    const womanLg = measurementsFromSockSize("woman_lg", adapter, "inches");
    const manSm = measurementsFromSockSize("man_sm", adapter, "inches");
    expect(womanLg?.footCircumference).toBe("9");
    expect(manSm?.footCircumference).toBe("9");
    expect(womanLg?.footLength).toBe("9.5");
    expect(manSm?.footLength).toBe("10");
  });
});

describe("sock builder customized measurements persist", () => {
  it("round-trips Perfect Fit overrides through the draft without replacing them on reload", () => {
    const storage = memoryStorage();
    const draft = createEmptySockDraft({
      sizeSel: "woman_med",
      constructionDirection: "cuff-to-toe",
      footCircumference: "9.25",
      footLength: "9.5",
      legCircumference: "10",
      legLength: "6",
      gaugeSlots: {
        inches: { stitch: "28", row: "40" },
        cm: { stitch: "", row: "" },
      },
      availableNeedles: "200",
    });
    writeSockDraft(draft, storage);
    const reloaded = readSockDraft(storage);
    expect(reloaded).not.toBeNull();
    const snap = snapshotFromSockDraft(reloaded!);
    expect(snap.footCircumference).toBe("9.25");
    expect(snap.footLength).toBe("9.5");
    expect(snap.legCircumference).toBe("10");
    expect(snap.legLength).toBe("6");
    expect(snap.sizeSel).toBe("woman_med");
    expect(isSockBuilderMeasurementsComplete(snap)).toBe(true);
  });
});

describe("sock builder unit switching", () => {
  it("converts finished measurements and maps UnitToggle detail units", () => {
    expect(draftUnitFromToggleDetail("cm")).toBe("cm");
    expect(draftUnitFromToggleDetail("in")).toBe("inches");
    expect(convertSockMeasurementDisplay("8.5", "inches", "cm")).toBe(
      formatSockMeasurementDisplay(8.5, "cm"),
    );
    expect(convertSockMeasurementDisplay("21.6", "cm", "inches")).toBe(
      formatSockMeasurementDisplay(21.6 / 2.54, "inches"),
    );
    expect(convertSockMeasurementDisplay("", "inches", "cm")).toBe("");
    const cmDefaults = measurementsFromSockSize("woman_med", adapter, "cm");
    expect(cmDefaults?.footCircumference).toBe(formatSockMeasurementDisplay(8.5, "cm"));
  });

  it("fills an empty cm gauge slot from inches without overwriting a filled slot", () => {
    const filled = maybeFillSockGaugeSlotFromOtherUnit(
      {
        inches: { stitch: "28", row: "40" },
        cm: { stitch: "", row: "" },
      },
      "inches",
      "cm",
    );
    expect(filled.cm.stitch).toBe((28 * SOCK_GAUGE_IN_TO_CM_FACTOR).toFixed(1));
    expect(filled.cm.row).toBe((40 * SOCK_GAUGE_IN_TO_CM_FACTOR).toFixed(1));
    expect(filled.inches).toEqual({ stitch: "28", row: "40" });

    const kept = maybeFillSockGaugeSlotFromOtherUnit(
      {
        inches: { stitch: "28", row: "40" },
        cm: { stitch: "22", row: "31" },
      },
      "inches",
      "cm",
    );
    expect(kept.cm).toEqual({ stitch: "22", row: "31" });
  });
});

describe("sock builder gauge persistence", () => {
  it("stores stitch and row gauge on the active unit slot and reloads them", () => {
    const storage = memoryStorage();
    writeSockDraft(
      createEmptySockDraft({
        unit: "inches",
        sizeSel: "child",
        gaugeSlots: {
          inches: { stitch: "28", row: "40" },
          cm: { stitch: "18", row: "24" },
        },
      }),
      storage,
    );
    const snap = snapshotFromSockDraft(readSockDraft(storage)!);
    expect(snap.stitchGauge).toBe("28");
    expect(snap.rowGauge).toBe("40");

    writeSockDraft(
      createEmptySockDraft({
        unit: "cm",
        gaugeSlots: {
          inches: { stitch: "28", row: "40" },
          cm: { stitch: "18", row: "24" },
        },
      }),
      storage,
    );
    expect(snapshotFromSockDraft(readSockDraft(storage)!).stitchGauge).toBe("18");
  });
});

describe("sock builder gauge sanity warning integration", () => {
  it("treats 4 stitches / 7 rows over 4 inches as a warning, not ordinary valid gauge", () => {
    const unusual: SockBuilderFieldSnapshot = {
      ...completeFields,
      stitchGauge: "4",
      rowGauge: "7",
    };
    expect(isSockBuilderInputComplete(unusual, adapter)).toBe(true);
    expect(isSockBuilderCtaEnabled(unusual, adapter, "inches")).toBe(true);
    const unusualGate = evaluateSockBuilderGaugeSanityGate(unusual, "inches");
    expect(unusualGate.proceed).toBe(false);
    if (!unusualGate.proceed) {
      expect(unusualGate.reason).toBe("unusual-gauge");
    }
    expect(
      evaluateSockBuilderGaugeSanityGate(unusual, "inches", "4|7|in").proceed,
    ).toBe(true);
    expect(evaluateSockBuilderGaugeSanityGate(completeFields, "inches").proceed).toBe(true);
  });
});

describe("sock builder construction direction persistence", () => {
  it("persists cuff-to-toe and toe-up without treating other values as complete", () => {
    expect(isSockBuilderConstructionComplete({ constructionDirection: "cuff-to-toe" })).toBe(
      true,
    );
    expect(isSockBuilderConstructionComplete({ constructionDirection: "toe-up" })).toBe(true);
    expect(isSockBuilderConstructionComplete({ constructionDirection: "" })).toBe(false);
    expect(isSockBuilderConstructionComplete({ constructionDirection: "sideways" })).toBe(
      false,
    );
    expect(sockBuilderChoiceFieldAdvances("constructionDirection")).toBe(true);

    const storage = memoryStorage();
    writeSockDraft(
      createEmptySockDraft({ constructionDirection: "toe-up" }),
      storage,
    );
    expect(readSockDraft(storage)?.constructionDirection).toBe("toe-up");
  });
});

describe("sock builder cuff-to-toe and toe-up retain identical geometry", () => {
  it("produces the same stitch and row counts from builder fields in both directions", () => {
    const cuffInput = {
      ...completeFields,
      constructionDirection: "cuff-to-toe" as const,
    };
    const toeInput = {
      ...completeFields,
      constructionDirection: "toe-up" as const,
    };
    const cuff = evaluateSockBuilderCalc(cuffInput, "inches");
    const toe = evaluateSockBuilderCalc(toeInput, "inches");
    expect(cuff).toEqual({ ok: true });
    expect(toe).toEqual({ ok: true });

    const cuffCalc = calculateBasicSockPattern({
      footCircumferenceInches: 8.5,
      footLengthInches: 9,
      legCircumferenceInches: 8.5,
      legLengthInches: 4.5,
      stitchGaugeDisplay: 28,
      rowGaugeDisplay: 40,
      displayUnit: "inches",
      constructionDirection: "cuff-to-toe",
    });
    const toeCalc = calculateBasicSockPattern({
      footCircumferenceInches: 8.5,
      footLengthInches: 9,
      legCircumferenceInches: 8.5,
      legLengthInches: 4.5,
      stitchGaugeDisplay: 28,
      rowGaugeDisplay: 40,
      displayUnit: "inches",
      constructionDirection: "toe-up",
    });
    expect(cuffCalc.ok && toeCalc.ok).toBe(true);
    if (!cuffCalc.ok || !toeCalc.ok) return;
    const { constructionDirection: _c, legShapingSchedule: cuffSchedule, ...cuffRest } =
      cuffCalc.calc;
    const { constructionDirection: _t, legShapingSchedule: toeSchedule, ...toeRest } =
      toeCalc.calc;
    const { knitOrder: cuffKnit, ...cuffGeometry } = cuffSchedule;
    const { knitOrder: toeKnit, ...toeGeometry } = toeSchedule;
    expect(cuffRest).toEqual(toeRest);
    expect(cuffGeometry).toEqual(toeGeometry);
    expect(cuffKnit.constructionDirection).toBe("cuff-to-toe");
    expect(toeKnit.constructionDirection).toBe("toe-up");
  });
});

describe("sock builder available needle validation", () => {
  it("compares required even-upped foot stitches against available needles", () => {
    const required = resolveSockBuilderRequiredNeedles(completeFields, "inches");
    expect(required).toBe(
      resolveSockRequiredNeedles({
        footCircumferenceInches: 8.5,
        stitchGaugeDisplay: 28,
        displayUnit: "inches",
      }),
    );
    expect(required).toBe(60);
    expect(
      isSockBuilderReadyToReview(
        { ...completeFields, availableNeedles: String(required) },
        adapter,
        "inches",
      ),
    ).toBe(true);
    expect(
      isSockBuilderCtaEnabled(
        { ...completeFields, availableNeedles: String(required - 1) },
        adapter,
        "inches",
      ),
    ).toBe(false);
    const capacity = evaluateSockBuilderNeedleCapacity(
      { ...completeFields, availableNeedles: "40" },
      "inches",
    );
    expect(capacity.ok).toBe(false);
    expect(capacity.message).toBe(buildSockNeedleCapacityMessage(60, 40));
    expect(validateSockNeedleCapacity("200", 60).ok).toBe(true);
  });
});

describe("sock builder required-field validation", () => {
  it("blocks progression when size, measurements, construction, gauge, or needles are missing", () => {
    expect(isSockBuilderInputComplete(completeFields, adapter)).toBe(true);
    expect(isSockBuilderInputComplete({ ...completeFields, sizeSel: "" }, adapter)).toBe(false);
    expect(
      isSockBuilderMeasurementsComplete({ ...completeFields, footCircumference: "" }),
    ).toBe(false);
    expect(
      isSockBuilderGaugeFieldsComplete({ ...completeFields, availableNeedles: "" }),
    ).toBe(false);
    expect(sockBuilderStepComplete(1, completeFields, adapter)).toBe(true);
    expect(
      sockBuilderStepComplete(4, { ...completeFields, stitchGauge: "" }, adapter, "inches"),
    ).toBe(false);
    expect(SOCK_BUILDER_INCOMPLETE_MESSAGE).toMatch(/Finish the required sections/i);
    expect(SOCK_BUILDER_STEPS).toBe(4);

    const afterSize = nextSockBuilderOpenStepAfterFieldChange({
      advance: true,
      openStep: 1,
      maxReachableAfter: 2,
      prevMaxReachable: 1,
      currentStepComplete: true,
    });
    expect(afterSize).toBe(2);
  });
});

describe("sock builder draft reload", () => {
  it("reloads a previously saved kbm_socks_draft without dropping valid selections", () => {
    const storage = memoryStorage();
    writeSockDraft(
      createEmptySockDraft({
        unit: "cm",
        sizeSel: "man_lg",
        constructionDirection: "toe-up",
        footCircumference: "25.4",
        footLength: "27.9",
        legCircumference: "25.4",
        legLength: "15.2",
        gaugeSlots: {
          inches: { stitch: "28", row: "40" },
          cm: { stitch: "22", row: "32" },
        },
        availableNeedles: "180",
      }),
      storage,
    );
    expect(storage.getItem(SOCK_DRAFT_STORAGE_KEY)).toContain('"patternType":"socks"');
    const snap = snapshotFromSockDraft(readSockDraft(storage)!);
    expect(snap.sizeSel).toBe("man_lg");
    expect(snap.constructionDirection).toBe("toe-up");
    expect(snap.stitchGauge).toBe("22");
    expect(snap.availableNeedles).toBe("180");
    expect(snap.footCircumference).toBe("25.4");
  });
});

describe("sock builder fresh start", () => {
  it("uses the Hat-style builder path and ?new=1 session flag", () => {
    expect(SOCK_BUILDER_PATH).toBe("/patterns/socks/builder");
    expect(buildSockBuilderNewPatternHref()).toBe("/patterns/socks/builder?new=1");
  });
});

describe("sock builder page wiring", () => {
  const builderPage = readFileSync(resolve("src/pages/patterns/socks/builder.astro"), "utf8");
  const builderScript = readFileSync(resolve("src/scripts/socks-builder-page.ts"), "utf8");

  it("opens a Hat-style ungated Socks Builder that persists to kbm_socks_draft", () => {
    expect(builderPage).toContain("patternWorkspace={true}");
    expect(builderPage).toMatch(/Free\s*\/\s*ungated/i);
    expect(builderPage).not.toContain("SleevelessPatternMemberGate");
    expect(builderPage).toContain("GaugeInput");
    expect(builderPage).toContain('id="gauge-sanity-warning"');
    expect(builderPage).toContain('id="express-available-needles"');
    expect(builderPage).toContain('id="socks-size"');
    expect(builderPage).toContain("Perfect Fit measurements");
    expect(builderPage).toContain("Foot Circumference");
    expect(builderPage).toContain("Leg Length");
    expect(builderPage).toContain("Cuff to Toe");
    expect(builderPage).toContain("Toe Up");
    expect(builderPage).toContain('data-value="cuff-to-toe"');
    expect(builderPage).toContain('data-value="toe-up"');
    expect(builderPage).not.toContain("ankle circumference");
    expect(builderPage).not.toContain("Fancy Socks");
    expect(builderScript).toContain("kbm_socks_draft");
    expect(builderScript).toContain("reconcilePatternDraftOwner");
    expect(builderScript).toContain("applySockNewSessionFromUrl");
    expect(builderScript).toContain("renderGaugeSanityWarning");
    expect(builderScript).toContain("evaluateSockBuilderGaugeSanityGate");
    expect(builderScript).toContain("convertSockMeasurementDisplay");
    expect(builderScript).toContain("applyChartDefaultsForSelectedSize");
    expect(builderScript).toContain("syncSockDraft");
    expect(builderScript).toContain("readSockDraft");
    expect(builderScript).toContain("buildSockSummaryFromBuilderHref");
    expect(builderScript).toMatch(/location\.assign\(buildSockSummaryFromBuilderHref\(\)\)/);
    expect(builderScript).not.toContain("SOCK_BUILDER_SUMMARY_NOT_READY_MESSAGE");
    expect(builderScript).not.toContain("Pattern summary is not available yet");
  });
});
