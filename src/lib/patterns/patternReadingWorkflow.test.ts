import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  chartProgressStorageKey,
  readChartProgressBlob,
  writeChartProgressBlob,
} from "./chartProgressStorage";
import {
  applySleevelessReadingWorkflow,
  collectSleevelessReadingWorkflow,
  SLEEVELESS_PATTERN_TIPS_STORAGE_KEY,
} from "./patternReadingWorkflow";
import { dismissedTipsStorageKey } from "./patternTipDismiss";
import type { PatternReadingWorkflowState } from "./patternReadingWorkflow";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import { loadProjectIntoWorkingDraft } from "./customPatternProjectClient";
import { getCurrentPattern } from "./patternStorage";
import { stubLocalStorage } from "./test/stubLocalStorage";

const PATTERN_ID = "pat-test-1";

function minimalSleevelessPattern(overrides: Record<string, unknown> = {}) {
  return {
    id: PATTERN_ID,
    patternType: "sleeveless" as const,
    version: 1,
    style: {},
    fit: {},
    yarnGauge: {},
    measurements: { chest: 40 },
    machine: {},
    calculations: {},
    instructions: {},
    patternProject: { title: "Test", notes: "" },
    ...overrides,
  };
}

describe("patternReadingWorkflow", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("collects and applies tips show/hide and dismissed tip ids", () => {
    localStorage.setItem(SLEEVELESS_PATTERN_TIPS_STORAGE_KEY, "false");
    localStorage.setItem(
      dismissedTipsStorageKey(SLEEVELESS_PATTERN_TIPS_STORAGE_KEY),
      JSON.stringify(["tip-a", "tip-b"]),
    );

    const collected = collectSleevelessReadingWorkflow(PATTERN_ID);
    expect(collected.tips?.showAll).toBe(false);
    expect(collected.tips?.dismissedTipIds).toEqual(["tip-a", "tip-b"]);

    localStorage.clear();
    applySleevelessReadingWorkflow(collected, PATTERN_ID);
    expect(localStorage.getItem(SLEEVELESS_PATTERN_TIPS_STORAGE_KEY)).toBe("false");
    expect(JSON.parse(localStorage.getItem(dismissedTipsStorageKey(SLEEVELESS_PATTERN_TIPS_STORAGE_KEY))!)).toEqual([
      "tip-a",
      "tip-b",
    ]);
  });

  it("collects and applies chart row progress and hide-completed", () => {
    const key = chartProgressStorageKey(PATTERN_ID, "ns-chart-primary");
    writeChartProgressBlob(key, {
      checkedRowIds: ["row-1", "row-2"],
      hideCompleted: true,
    });

    const collected = collectSleevelessReadingWorkflow(PATTERN_ID);
    expect(collected.charts?.["ns-chart-primary"]).toEqual({
      checkedRowIds: ["row-1", "row-2"],
      hideCompleted: true,
    });

    localStorage.removeItem(key);
    applySleevelessReadingWorkflow(collected, PATTERN_ID);
    expect(readChartProgressBlob(key)).toEqual({
      checkedRowIds: ["row-1", "row-2"],
      hideCompleted: true,
    });
  });

  it("loadProjectIntoWorkingDraft restores workflow without changing structural measurements", () => {
    const workflow: PatternReadingWorkflowState = {
      tips: { showAll: false, dismissedTipIds: ["tip-x"] },
      charts: {
        "ns-chart-primary": { checkedRowIds: ["r1"], hideCompleted: false },
      },
    };
    const project: CustomPatternProject = {
      id: "proj-1",
      name: "My Vest",
      family: "sleeveless",
      source: "custom-build",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-02T00:00:00.000Z",
      version: 3,
      pattern: minimalSleevelessPattern({ measurements: { chest: 42, length: 24 } }),
      customOverrides: {},
      readingWorkflow: workflow,
    };

    loadProjectIntoWorkingDraft(project);
    const draft = getCurrentPattern();
    expect(draft.measurements).toEqual({ chest: 42, length: 24 });
    expect(localStorage.getItem(SLEEVELESS_PATTERN_TIPS_STORAGE_KEY)).toBe("false");
    expect(readChartProgressBlob(chartProgressStorageKey(PATTERN_ID, "ns-chart-primary")).checkedRowIds).toEqual([
      "r1",
    ]);
  });

  it("collect omits structural pattern fields", () => {
    localStorage.setItem(SLEEVELESS_PATTERN_TIPS_STORAGE_KEY, "true");
    const collected = collectSleevelessReadingWorkflow(PATTERN_ID);
    expect(collected).not.toHaveProperty("pattern");
    expect(collected).not.toHaveProperty("measurements");
    expect(collected).not.toHaveProperty("gauge");
  });
});
