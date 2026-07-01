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
  runSaveCustomPatternFromWorkspace,
  runUpdateActiveSavedCustomPattern,
} from "./customPatternEditingBannerActions";
import { saveCurrentPattern } from "./patternStorage";
import {
  SLEEVELESS_SAVE_ALREADY_CLAIMED_COPY,
  SLEEVELESS_SAVE_LOGGED_OUT_COPY,
} from "./sleevelessPatternProjectCloudSave";

vi.mock("./customPatternSavedProjectsPanel", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./customPatternSavedProjectsPanel")>();
  return {
    ...actual,
    smartSaveCustomPatternProject: vi.fn(),
  };
});

vi.mock("./sleevelessPatternSystemAccessClient", () => ({
  resolveSleevelessUserAccess: vi.fn(),
  markFreeSleevelessPatternClaimed: vi.fn().mockResolvedValue(true),
}));

vi.mock("./sleevelessPatternSystemAccess", () => ({
  canCreateSleevelessPattern: vi.fn(),
}));

import { smartSaveCustomPatternProject } from "./customPatternSavedProjectsPanel";
import {
  markFreeSleevelessPatternClaimed,
  resolveSleevelessUserAccess,
} from "./sleevelessPatternSystemAccessClient";
import { canCreateSleevelessPattern } from "./sleevelessPatternSystemAccess";

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

  it("prefers the edit drawer title input over review and draft meta", () => {
    saveCurrentPattern({
      patternProject: { title: "Draft title", notes: "", titleCustomized: true },
    });
    const root = {
      querySelector(sel: string) {
        if (sel === "#sl-edit-title") {
          return { value: "Workspace title" } as HTMLInputElement;
        }
        if (sel === "[data-sleeveless-pattern-project-title]") {
          return { value: SUES_PATTERN } as HTMLInputElement;
        }
        return null;
      },
    } as unknown as ParentNode;
    expect(resolveProjectNameForEditingBannerUpdate(root)).toBe("Workspace title");
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
    vi.mocked(resolveSleevelessUserAccess).mockResolvedValue({
      loggedIn: true,
      hasSystemAccess: true,
      freeClaimed: false,
    });
    vi.mocked(canCreateSleevelessPattern).mockReturnValue(true);
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
        activeProjectId: "proj-sue",
        resolveName: expect.any(Function),
        root: measureRoot,
      }),
    );
  });

  it("passes pinned activeProjectId and can skip pre-save prepare", async () => {
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

    await runUpdateActiveSavedCustomPattern(undefined, {
      activeProjectId: "proj-sue",
      skipPreSavePrepare: true,
    });

    expect(smartSaveCustomPatternProject).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "update",
        activeProjectId: "proj-sue",
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

describe("runSaveCustomPatternFromWorkspace", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(resolveSleevelessUserAccess).mockResolvedValue({
      loggedIn: true,
      hasSystemAccess: true,
      freeClaimed: false,
    });
    vi.mocked(canCreateSleevelessPattern).mockReturnValue(true);
  });

  it("creates a new saved project when none is linked", async () => {
    saveCurrentPattern({
      patternProject: { title: "New vest", notes: "note", titleCustomized: true },
    });
    vi.mocked(smartSaveCustomPatternProject).mockResolvedValue({
      ok: true,
      created: true,
      project: {
        id: "proj-new",
        name: "New vest",
        family: "sleeveless",
        source: "express",
        notes: "",
        pattern: {},
        customOverrides: {},
        createdAt: "",
        updatedAt: "",
      },
    });

    const root = {
      querySelector(sel: string) {
        if (sel === "#sl-edit-title") return { value: "New vest" } as HTMLInputElement;
        return null;
      },
      querySelectorAll: () => [],
    } as unknown as ParentNode;

    const res = await runSaveCustomPatternFromWorkspace(root, { skipPreSavePrepare: true });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.created).toBe(true);
    expect(smartSaveCustomPatternProject).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "create" }),
    );
    expect(markFreeSleevelessPatternClaimed).toHaveBeenCalledWith("proj-new");
  });

  it("blocks create for logged-out users", async () => {
    vi.mocked(resolveSleevelessUserAccess).mockResolvedValue({
      loggedIn: false,
      hasSystemAccess: false,
      freeClaimed: false,
    });
    vi.mocked(canCreateSleevelessPattern).mockReturnValue(false);

    saveCurrentPattern({
      patternProject: { title: "New vest", notes: "", titleCustomized: true },
    });

    const res = await runSaveCustomPatternFromWorkspace();
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe(SLEEVELESS_SAVE_LOGGED_OUT_COPY);
    expect(smartSaveCustomPatternProject).not.toHaveBeenCalled();
  });

  it("blocks create when free allowance is already used", async () => {
    vi.mocked(resolveSleevelessUserAccess).mockResolvedValue({
      loggedIn: true,
      hasSystemAccess: false,
      freeClaimed: true,
      freeClaimedPatternId: "pat_1",
    });
    vi.mocked(canCreateSleevelessPattern).mockReturnValue(false);

    saveCurrentPattern({
      patternProject: { title: "Second vest", notes: "", titleCustomized: true },
    });

    const res = await runSaveCustomPatternFromWorkspace();
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe(SLEEVELESS_SAVE_ALREADY_CLAIMED_COPY);
    expect(smartSaveCustomPatternProject).not.toHaveBeenCalled();
  });

  it("does not re-mark free claim when updating an existing saved project", async () => {
    writeActiveCustomPatternProjectId("proj-sue", SUES_PATTERN);
    saveCurrentPattern({
      patternProject: { title: SUES_PATTERN, notes: "", titleCustomized: true },
    });
    vi.mocked(smartSaveCustomPatternProject).mockResolvedValue({
      ok: true,
      created: false,
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
    });

    const res = await runSaveCustomPatternFromWorkspace(undefined, { skipPreSavePrepare: true });
    expect(res.ok).toBe(true);
    expect(markFreeSleevelessPatternClaimed).not.toHaveBeenCalled();
  });
});
