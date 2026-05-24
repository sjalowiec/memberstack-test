import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY } from "./customPatternProjectActiveId";
import { chartProgressStorageKey, writeChartProgressBlob } from "./chartProgressStorage";
import { SLEEVELESS_PATTERN_TIPS_STORAGE_KEY } from "./patternReadingWorkflow";
import {
  flushReadingWorkflowSync,
  resetReadingWorkflowSyncForTests,
  scheduleReadingWorkflowSync,
} from "./patternReadingWorkflowSync";

vi.mock("./customPatternProjectClient", () => ({
  patchCustomPatternProjectReadingWorkflow: vi.fn().mockResolvedValue({ ok: true, project: { id: "proj-1" } }),
}));

import { patchCustomPatternProjectReadingWorkflow } from "./customPatternProjectClient";
import { stubLocalStorage } from "./test/stubLocalStorage";

describe("patternReadingWorkflowSync", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    resetReadingWorkflowSyncForTests();
    vi.clearAllMocks();
    localStorage.setItem(CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY, "proj-1");
  });

  afterEach(() => {
    resetReadingWorkflowSyncForTests();
    localStorage.clear();
  });

  it("does not patch when no active saved project", async () => {
    localStorage.removeItem(CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY);
    writeChartProgressBlob(chartProgressStorageKey("pat-1", "c1"), {
      checkedRowIds: ["r1"],
      hideCompleted: false,
    });
    await flushReadingWorkflowSync();
    expect(patchCustomPatternProjectReadingWorkflow).not.toHaveBeenCalled();
  });

  it("debounces patch to saved project with workflow payload only", async () => {
    vi.useFakeTimers();
    const patternId = "pat-1";
    localStorage.setItem(SLEEVELESS_PATTERN_TIPS_STORAGE_KEY, "false");
    writeChartProgressBlob(chartProgressStorageKey(patternId, "c1"), {
      checkedRowIds: ["row-a"],
      hideCompleted: true,
    });

    scheduleReadingWorkflowSync(patternId);
    expect(patchCustomPatternProjectReadingWorkflow).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(700);
    expect(patchCustomPatternProjectReadingWorkflow).toHaveBeenCalledTimes(1);
    const [projectId, workflow] = vi.mocked(patchCustomPatternProjectReadingWorkflow).mock.calls[0];
    expect(projectId).toBe("proj-1");
    expect(workflow.tips?.showAll).toBe(false);
    expect(workflow.charts?.c1?.checkedRowIds).toEqual(["row-a"]);
    expect(workflow.charts?.c1?.hideCompleted).toBe(true);
    expect(workflow).not.toHaveProperty("pattern");
    vi.useRealTimers();
  });
});
