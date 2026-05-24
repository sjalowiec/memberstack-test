import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import {
  buildChangePatternChoicesHref,
  buildExpressValuesFromPattern,
  isExpressGaugeStepEditable,
  restoreSleevelessExpressBuilderFromPattern,
} from "./restoreSleevelessExpressBuilderFromPattern";
import { loadExpressPersisted } from "./sleevelessExpressResume";
import {
  PATTERN_STORAGE_KEY,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
  type SleevelessPatternRecord,
} from "./patternStorage";

function samplePattern(overrides: Partial<SleevelessPatternRecord> = {}): SleevelessPatternRecord {
  return {
    id: "draft-1",
    patternType: "sleeveless",
    status: "draft",
    version: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    patternProject: { title: "Aubrey Vest", notes: "Test notes", titleCustomized: true },
    style: {
      recipientCategory: "misses",
      bodyShape: "aline",
      frontStyle: "open",
      garmentStyle: "cardigan",
      neckline: "v",
      patternMode: "express",
    },
    fit: {
      sizingChart: "misses",
      selectedSize: "M",
      easeChoice: "standard",
      fitChoice: "standard",
    },
    yarnGauge: {
      gaugeStitchRaw: "22",
      gaugeRowRaw: "28",
      gaugeRawUnit: "in",
    },
    measurements: {},
    machine: { availableNeedles: "180" },
    calculations: {},
    instructions: {},
    ...overrides,
  };
}

describe("restoreSleevelessExpressBuilderFromPattern", () => {
  beforeEach(() => {
    stubLocalStorage();
    vi.stubGlobal("window", {
      location: { href: "http://localhost/patterns/sleeveless-express?edit=choices" },
      history: { replaceState: vi.fn() },
    });
  });

  it("maps canonical pattern sections to Express wizard values", () => {
    const values = buildExpressValuesFromPattern(
      samplePattern(),
      { yarnGaugeMachine: { availableNeedles: "180" } },
    );
    expect(values.who).toBe("women");
    expect(values.selectedSize).toBe("M");
    expect(values.fit).toBe("standard");
    expect(values.neckline).toBe("v-neck");
    expect(values.style).toBe("shaped-cardigan");
    expect(values.front).toBe("open");
  });

  it("writes express builder snapshot without clearing active saved project id", () => {
    writeActiveCustomPatternProjectId("proj-aubrey");
    localStorage.setItem(PATTERN_STORAGE_KEY, JSON.stringify(samplePattern()));

    const ok = restoreSleevelessExpressBuilderFromPattern(samplePattern());
    expect(ok).toBe(true);

    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const snap = JSON.parse(raw!) as {
      values: Record<string, string>;
      gaugeStitchRaw?: string;
      availableNeedles?: string;
    };
    expect(snap.values.who).toBe("women");
    expect(snap.values.selectedSize).toBe("M");
    expect(snap.gaugeStitchRaw).toBe("22");
    expect(snap.availableNeedles).toBe("180");
    expect(localStorage.getItem(CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY)).toBe("proj-aubrey");
  });

  it("editChoicesReopen unlocks gauge and opens step 5 with prefilled snapshot", () => {
    restoreSleevelessExpressBuilderFromPattern(samplePattern(), {}, { editChoicesReopen: true });
    const persisted = loadExpressPersisted();
    expect(persisted?.editChoicesReopen).toBe(true);
    expect(persisted?.openStep).toBe(5);
    expect(persisted?.maxReachable).toBe(5);
    expect(isExpressGaugeStepEditable(persisted, persisted?.values ?? {})).toBe(true);
  });

  it("infers front from style when canonical frontStyle is missing", () => {
    const values = buildExpressValuesFromPattern(
      samplePattern({
        style: {
          recipientCategory: "misses",
          bodyShape: "aline",
          garmentStyle: "cardigan",
          neckline: "v",
          patternMode: "express",
        },
      }),
    );
    expect(values.front).toBe("open");
    expect(values.style).toBe("shaped-cardigan");
  });

  it("buildChangePatternChoicesHref routes express vs custom-build", () => {
    expect(buildChangePatternChoicesHref("express")).toBe(
      "/patterns/sleeveless-express?edit=choices",
    );
    expect(buildChangePatternChoicesHref("custom-build")).toBe(
      "/patterns/sleeveless/custom-build/design?edit=choices",
    );
  });
});
