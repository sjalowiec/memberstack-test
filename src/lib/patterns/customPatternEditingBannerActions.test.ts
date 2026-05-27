import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  clearActiveCustomPatternProjectId,
  readActiveCustomPatternProjectId,
  readActiveCustomPatternProjectLinkedName,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import {
  exitEditingSavedCustomPattern,
  resolveProjectNameForEditingBannerUpdate,
  runUpdateActiveSavedCustomPattern,
} from "./customPatternEditingBannerActions";
import { saveCurrentPattern } from "./patternStorage";

vi.mock("./customPatternSavedProjectsPanel", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./customPatternSavedProjectsPanel")>();
  return {
    ...actual,
    smartSaveCustomPatternProject: vi.fn(),
  };
});

import { smartSaveCustomPatternProject } from "./customPatternSavedProjectsPanel";

const SUES_PATTERN = "Sue's test pattern";

describe("exitEditingSavedCustomPattern", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("clears active project id and linked name without deleting blob storage", () => {
    writeActiveCustomPatternProjectId("proj-sue", SUES_PATTERN);
    exitEditingSavedCustomPattern();
    expect(readActiveCustomPatternProjectId()).toBe("");
    expect(readActiveCustomPatternProjectLinkedName()).toBe("");
  });

  it("does not save changes when exiting editing mode", async () => {
    writeActiveCustomPatternProjectId("proj-sue", SUES_PATTERN);
    saveCurrentPattern({
      patternProject: { title: SUES_PATTERN, notes: "", titleCustomized: true },
    });
    exitEditingSavedCustomPattern();
    expect(smartSaveCustomPatternProject).not.toHaveBeenCalled();
  });
});

describe("resolveProjectNameForEditingBannerUpdate", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("prefers the review title input over draft meta", () => {
    saveCurrentPattern({
      patternProject: { title: "Draft title", notes: "", titleCustomized: true },
    });
    const root = {
      querySelector(sel: string) {
        if (sel === "[data-sleeveless-pattern-project-title]") {
          return { value: SUES_PATTERN } as HTMLInputElement;
        }
        return null;
      },
    } as unknown as ParentNode;
    expect(resolveProjectNameForEditingBannerUpdate(root)).toBe(SUES_PATTERN);
  });
});

describe("runUpdateActiveSavedCustomPattern", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("calls update mode on the active saved project", async () => {
    writeActiveCustomPatternProjectId("proj-sue", SUES_PATTERN);
    saveCurrentPattern({
      patternProject: { title: SUES_PATTERN, notes: "", titleCustomized: true },
    });
    vi.mocked(smartSaveCustomPatternProject).mockResolvedValue({
      ok: true,
      project: {
        id: "proj-sue",
        name: SUES_PATTERN,
        family: "sleeveless",
        source: "express",
        notes: "",
        pattern: {},
        customOverrides: {},
        createdAt: "",
        updatedAt: "",
      },
      created: false,
    });

    const measureRoot = {
      querySelector: () => null,
      querySelectorAll: () => [],
    } as unknown as ParentNode;

    const res = await runUpdateActiveSavedCustomPattern(measureRoot);
    expect(res.ok).toBe(true);
    expect(smartSaveCustomPatternProject).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "update",
        resolveName: expect.any(Function),
        root: measureRoot,
      }),
    );
  });

  it("fails when no active saved project is linked", async () => {
    clearActiveCustomPatternProjectId();
    const res = await runUpdateActiveSavedCustomPattern();
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/saved project/i);
  });
});
