import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  readActiveCustomPatternProjectId,
  readActiveCustomPatternProjectLinkedName,
} from "./customPatternProjectActiveId";
import * as workflowModule from "./patternReadingWorkflow";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import {
  CUSTOM_BUILD_EDIT_WORKSPACE_HREF,
  DROP_SHOULDER_CONTINUE_EDITING_HREF,
  DROP_SHOULDER_OPEN_PATTERN_EDIT_WORKSPACE_HREF,
  DROP_SHOULDER_OPEN_PATTERN_HREF,
  EXPRESS_CONTINUE_EDITING_HREF,
  EXPRESS_EDIT_WORKSPACE_HREF,
  HAT_OPEN_PATTERN_EDIT_WORKSPACE_HREF,
  HAT_OPEN_PATTERN_HREF,
  SOCK_OPEN_PATTERN_EDIT_WORKSPACE_HREF,
  SOCK_OPEN_PATTERN_HREF,
  OPEN_PATTERN_EDIT_WORKSPACE_HREF,
  OPEN_PATTERN_HREF,
} from "./customPatternProjectNavigation";
import {
  CONSTRUCTION_FAMILY_OVERRIDE_KEY,
  DROP_SHOULDER_CONSTRUCTION,
  withDropShoulderConstructionAuthored,
} from "./patternConstructionIdentity";
import {
  PATTERN_STORAGE_KEY,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";
import { HAT_DRAFT_STORAGE_KEY, createEmptyHatDraft, readHatDraft, writeHatDraft } from "./hat/hatDraft";
import {
  readHatActiveProjectId,
  readHatActiveProjectLinkedName,
  writeHatActiveProjectId,
} from "./hat/hatSavedProject";
import {
  SOCK_DRAFT_STORAGE_KEY,
  createEmptySockDraft,
  readSockDraft,
  writeSockDraft,
} from "./sock/sockDraft";
import {
  readSockActiveProjectId,
  readSockActiveProjectLinkedName,
  writeSockActiveProjectId,
} from "./sock/sockSavedProject";
import * as restoreModule from "./restoreSleevelessExpressBuilderFromPattern";

const PROJECT_ID = "proj-aubrie";

function sampleProject(overrides: Partial<CustomPatternProject> = {}): CustomPatternProject {
  return {
    id: PROJECT_ID,
    name: "For Aubrie",
    family: "sleeveless",
    source: "express",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    version: 1,
    customOverrides: {},
    pattern: {
      id: "pattern-1",
      patternType: "sleeveless",
      status: "draft",
      version: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      style: {
        recipientCategory: "misses",
        bodyShape: "aline",
        frontStyle: "open",
        garmentStyle: "cardigan",
        neckline: "v",
        patternMode: "express",
      },
      fit: { selectedSize: "M", easeChoice: "standard" },
      yarnGauge: { gaugeStitchRaw: "22", gaugeRowRaw: "28" },
      measurements: {},
      machine: {},
      calculations: {},
      instructions: {},
      patternProject: { title: "For Aubrie", notes: "note", titleCustomized: true },
    },
    ...overrides,
  };
}

const loadCustomPatternProjectMock = vi.fn();

vi.mock("./customPatternProjectClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./customPatternProjectClient")>();
  return {
    ...actual,
    loadCustomPatternProject: (...args: unknown[]) => loadCustomPatternProjectMock(...args),
  };
});

import { loadProjectIntoWorkingDraft } from "./customPatternProjectClient";
import { loadSavedCustomPatternProject } from "./loadSavedCustomPatternProject";

describe("loadSavedCustomPatternProject", () => {
  beforeEach(() => {
    stubLocalStorage();
    loadCustomPatternProjectMock.mockReset();
  });

  it("opens express projects in the pattern page's auto-opened Edit Pattern Workspace and links the active project id", async () => {
    loadCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      project: sampleProject(),
    });

    const result = await loadSavedCustomPatternProject(PROJECT_ID, "open");

    // In-place split workspace on the pattern page (quick edits + measurements), auto-opened via
    // the `?edit=1` flag — not the standalone review page, the step wizard, or read-only output.
    expect(result).toEqual({ ok: true, redirectHref: OPEN_PATTERN_EDIT_WORKSPACE_HREF });
    if (result.ok) {
      expect(result.redirectHref).toContain(OPEN_PATTERN_HREF);
      expect(result.redirectHref).not.toBe(OPEN_PATTERN_HREF);
      expect(result.redirectHref).toBe(EXPRESS_CONTINUE_EDITING_HREF);
      expect(result.redirectHref).not.toBe(EXPRESS_EDIT_WORKSPACE_HREF);
      expect(result.redirectHref).not.toContain("/review");
    }
    expect(readActiveCustomPatternProjectId()).toBe(PROJECT_ID);
    expect(localStorage.getItem(PATTERN_STORAGE_KEY)).toContain("For Aubrie");
  });

  it("views a saved drop-shoulder pattern on the drop-shoulder workspace", async () => {
    loadCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      project: sampleProject({
        customOverrides: { [CONSTRUCTION_FAMILY_OVERRIDE_KEY]: DROP_SHOULDER_CONSTRUCTION },
        pattern: {
          ...sampleProject().pattern,
          style: withDropShoulderConstructionAuthored(
            { ...(sampleProject().pattern.style as Record<string, unknown>) },
            "long",
          ),
        },
      }),
    });

    const result = await loadSavedCustomPatternProject(PROJECT_ID, "view");

    expect(result).toEqual({
      ok: true,
      redirectHref: `${DROP_SHOULDER_OPEN_PATTERN_HREF}?project=${PROJECT_ID}`,
    });
    if (result.ok) {
      expect(result.redirectHref).toContain(DROP_SHOULDER_OPEN_PATTERN_HREF);
      expect(result.redirectHref).toContain(`project=${PROJECT_ID}`);
      expect(result.redirectHref).not.toContain("/patterns/sleeveless/pattern/");
    }
  });

  it("continues a saved drop-shoulder express project on the drop-shoulder edit workspace", async () => {
    loadCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      project: sampleProject({
        customOverrides: { [CONSTRUCTION_FAMILY_OVERRIDE_KEY]: DROP_SHOULDER_CONSTRUCTION },
        pattern: {
          ...sampleProject().pattern,
          style: withDropShoulderConstructionAuthored(
            { ...(sampleProject().pattern.style as Record<string, unknown>) },
            "long",
          ),
        },
      }),
    });

    const result = await loadSavedCustomPatternProject(PROJECT_ID, "continue");

    expect(result).toEqual({ ok: true, redirectHref: DROP_SHOULDER_CONTINUE_EDITING_HREF });
    if (result.ok) {
      expect(result.redirectHref).not.toBe(EXPRESS_CONTINUE_EDITING_HREF);
      expect(result.redirectHref).toBe(DROP_SHOULDER_OPEN_PATTERN_EDIT_WORKSPACE_HREF);
      expect(result.redirectHref).not.toContain("/review");
    }
  });

  it("continues a saved sleeveless express project on the sleeveless edit workspace", async () => {
    loadCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      project: sampleProject(),
    });

    const result = await loadSavedCustomPatternProject(PROJECT_ID, "continue");

    expect(result).toEqual({ ok: true, redirectHref: EXPRESS_CONTINUE_EDITING_HREF });
    if (result.ok) {
      expect(result.redirectHref).not.toBe(DROP_SHOULDER_CONTINUE_EDITING_HREF);
      expect(result.redirectHref).toBe(OPEN_PATTERN_EDIT_WORKSPACE_HREF);
      expect(result.redirectHref).not.toContain("/review");
    }
  });

  it("opens a saved drop-shoulder express project on the drop-shoulder edit workspace", async () => {
    loadCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      project: sampleProject({
        customOverrides: { [CONSTRUCTION_FAMILY_OVERRIDE_KEY]: DROP_SHOULDER_CONSTRUCTION },
        pattern: {
          ...sampleProject().pattern,
          style: withDropShoulderConstructionAuthored(
            { ...(sampleProject().pattern.style as Record<string, unknown>) },
            "long",
          ),
        },
      }),
    });

    const result = await loadSavedCustomPatternProject(PROJECT_ID, "open");

    expect(result).toEqual({ ok: true, redirectHref: DROP_SHOULDER_OPEN_PATTERN_EDIT_WORKSPACE_HREF });
    if (result.ok) {
      expect(result.redirectHref).not.toContain("/patterns/sleeveless/pattern/");
    }
  });

  it("views a saved hat on the hat pattern page and hydrates kbm_hat_draft with the saved name", async () => {
    const hatDraft = {
      version: 1,
      patternType: "hat" as const,
      patternSystem: "hat" as const,
      unit: "inches" as const,
      sizeSel: "adult_woman",
      customCircumference: "",
      brimType: "single",
      brimLength: "2",
      crownShaping: "gathered",
      fit: "watchcap",
      customHatLength: "",
      gaugeSlots: { inches: { stitch: "7", row: "10" }, cm: { stitch: "", row: "" } },
      availableNeedles: "200",
      showTips: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
      patternProject: { title: "Sue's Hiking Hat", notes: "", titleCustomized: true },
    };
    loadCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      project: sampleProject({
        name: "Sue's Hiking Hat",
        pattern: hatDraft as unknown as CustomPatternProject["pattern"],
      }),
    });

    const result = await loadSavedCustomPatternProject(PROJECT_ID, "view");

    expect(result).toEqual({
      ok: true,
      redirectHref: `${HAT_OPEN_PATTERN_HREF}?project=${PROJECT_ID}`,
    });
    expect(readHatDraft()?.patternProject?.title).toBe("Sue's Hiking Hat");
    expect(readHatActiveProjectId()).toBe(PROJECT_ID);
    expect(readHatActiveProjectLinkedName()).toBe("Sue's Hiking Hat");
    expect(readActiveCustomPatternProjectLinkedName()).not.toBe("Sue's Hiking Hat");
    expect(localStorage.getItem(HAT_DRAFT_STORAGE_KEY)).toContain("Sue's Hiking Hat");
    expect(localStorage.getItem(PATTERN_STORAGE_KEY) ?? "").not.toContain("Sue's Hiking Hat");
  });

  it("opens a saved hat on the hat Summary/Edit workspace", async () => {
    loadCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      project: sampleProject({
        name: "Sue's Hiking Hat",
        pattern: {
          patternType: "hat",
          patternSystem: "hat",
        } as unknown as CustomPatternProject["pattern"],
      }),
    });

    const result = await loadSavedCustomPatternProject(PROJECT_ID, "open");
    expect(result).toEqual({
      ok: true,
      redirectHref: `${HAT_OPEN_PATTERN_EDIT_WORKSPACE_HREF}&project=${PROJECT_ID}`,
    });
    if (result.ok) {
      expect(result.redirectHref).toContain("edit=1");
      expect(result.redirectHref).toContain(`project=${PROJECT_ID}`);
    }
  });

  it("opens a saved hat by replacing a leftover local Hat draft with the selected project", async () => {
    writeHatDraft(
      createEmptyHatDraft({
        sizeSel: "preemie",
        brimType: "rolled",
        gaugeSlots: { inches: { stitch: "9", row: "12" }, cm: { stitch: "", row: "" } },
        patternProject: { title: "Stale Local Hat", notes: "", titleCustomized: true },
      }),
    );
    writeHatActiveProjectId("proj-stale", "Stale Local Hat");
    loadCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      project: sampleProject({
        name: "Camp Hat",
        pattern: {
          patternType: "hat",
          patternSystem: "hat",
          unit: "inches",
          sizeSel: "adult_woman",
          brimType: "single",
          gaugeSlots: { inches: { stitch: "5", row: "7" }, cm: { stitch: "", row: "" } },
          patternProject: { title: "Camp Hat", notes: "", titleCustomized: true },
        } as unknown as CustomPatternProject["pattern"],
      }),
    });

    const result = await loadSavedCustomPatternProject(PROJECT_ID, "open");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.redirectHref).toContain(`project=${PROJECT_ID}`);
    }
    expect(readHatDraft()?.patternProject?.title).toBe("Camp Hat");
    expect(readHatDraft()?.gaugeSlots.inches).toEqual({ stitch: "5", row: "7" });
    expect(readHatActiveProjectId()).toBe(PROJECT_ID);
    expect(readHatDraft()?.patternProject?.title).not.toBe("Stale Local Hat");
  });

  it("views a saved socks pattern on the socks pattern page and hydrates kbm_socks_draft with the saved name", async () => {
    const sockDraft = {
      version: 1,
      patternType: "socks" as const,
      patternSystem: "socks" as const,
      unit: "inches" as const,
      sizeSel: "woman_med",
      constructionDirection: "cuff-to-toe" as const,
      footCircumference: "8.5",
      footLength: "9",
      legCircumference: "8.5",
      legLength: "4.5",
      gaugeSlots: { inches: { stitch: "28", row: "40" }, cm: { stitch: "", row: "" } },
      availableNeedles: "200",
      updatedAt: "2026-01-01T00:00:00.000Z",
      patternProject: { title: "Aubrie's Hiking Socks", notes: "", titleCustomized: true },
    };
    loadCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      project: sampleProject({
        name: "Aubrie's Hiking Socks",
        pattern: sockDraft as unknown as CustomPatternProject["pattern"],
      }),
    });

    const result = await loadSavedCustomPatternProject(PROJECT_ID, "view");

    expect(result).toEqual({
      ok: true,
      redirectHref: `${SOCK_OPEN_PATTERN_HREF}?project=${PROJECT_ID}`,
    });
    expect(readSockDraft()?.patternProject?.title).toBe("Aubrie's Hiking Socks");
    expect(readSockActiveProjectId()).toBe(PROJECT_ID);
    expect(readSockActiveProjectLinkedName()).toBe("Aubrie's Hiking Socks");
    expect(readActiveCustomPatternProjectLinkedName()).not.toBe("Aubrie's Hiking Socks");
    expect(localStorage.getItem(SOCK_DRAFT_STORAGE_KEY)).toContain("Aubrie's Hiking Socks");
    expect(localStorage.getItem(PATTERN_STORAGE_KEY) ?? "").not.toContain("Aubrie's Hiking Socks");
  });

  it("opens a saved socks pattern on the socks Edit workspace", async () => {
    loadCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      project: sampleProject({
        name: "Aubrie's Hiking Socks",
        pattern: {
          patternType: "socks",
          patternSystem: "socks",
        } as unknown as CustomPatternProject["pattern"],
      }),
    });

    const result = await loadSavedCustomPatternProject(PROJECT_ID, "open");
    expect(result).toEqual({
      ok: true,
      redirectHref: `${SOCK_OPEN_PATTERN_EDIT_WORKSPACE_HREF}&project=${PROJECT_ID}`,
    });
    if (result.ok) {
      expect(result.redirectHref).toContain("edit=1");
      expect(result.redirectHref).toContain(`project=${PROJECT_ID}`);
    }
  });

  it("opens a saved socks pattern by replacing a leftover local Socks draft with the selected project", async () => {
    writeSockDraft(
      createEmptySockDraft({
        sizeSel: "child",
        constructionDirection: "toe-up",
        patternProject: { title: "Stale Local Socks", notes: "", titleCustomized: true },
      }),
    );
    writeSockActiveProjectId("proj-stale", "Stale Local Socks");
    loadCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      project: sampleProject({
        name: "Camp Socks",
        pattern: {
          patternType: "socks",
          patternSystem: "socks",
          unit: "inches",
          sizeSel: "woman_med",
          constructionDirection: "cuff-to-toe",
          gaugeSlots: { inches: { stitch: "28", row: "40" }, cm: { stitch: "", row: "" } },
          patternProject: { title: "Camp Socks", notes: "", titleCustomized: true },
        } as unknown as CustomPatternProject["pattern"],
      }),
    });

    const result = await loadSavedCustomPatternProject(PROJECT_ID, "open");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.redirectHref).toContain(`project=${PROJECT_ID}`);
    }
    expect(readSockDraft()?.patternProject?.title).toBe("Camp Socks");
    expect(readSockDraft()?.sizeSel).toBe("woman_med");
    expect(readSockActiveProjectId()).toBe(PROJECT_ID);
    expect(readSockDraft()?.patternProject?.title).not.toBe("Stale Local Socks");
  });

  it("views a saved pattern by routing to the read-only pattern page, never the edit workspace", async () => {
    loadCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      project: sampleProject(),
    });

    const result = await loadSavedCustomPatternProject(PROJECT_ID, "view");

    expect(result).toEqual({ ok: true, redirectHref: `${OPEN_PATTERN_HREF}?project=${PROJECT_ID}` });
    if (result.ok) {
      expect(result.redirectHref).toContain(OPEN_PATTERN_HREF);
      // The saved project id rides in the URL so the destination page loads it authoritatively.
      expect(result.redirectHref).toContain(`project=${PROJECT_ID}`);
      expect(result.redirectHref).not.toBe(EXPRESS_EDIT_WORKSPACE_HREF);
      expect(result.redirectHref).not.toContain("edit=choices");
    }
    // Working draft is still hydrated so the pattern page can render the saved pattern.
    expect(readActiveCustomPatternProjectId()).toBe(PROJECT_ID);
    expect(localStorage.getItem(PATTERN_STORAGE_KEY)).toContain("For Aubrie");
  });

  it("views a custom-build saved pattern on the same pattern page (source-independent)", async () => {
    loadCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      project: sampleProject({ source: "custom-build" }),
    });

    const result = await loadSavedCustomPatternProject(PROJECT_ID, "view");

    expect(result).toEqual({ ok: true, redirectHref: `${OPEN_PATTERN_HREF}?project=${PROJECT_ID}` });
    if (result.ok) {
      expect(result.redirectHref).toContain(`project=${PROJECT_ID}`);
      expect(result.redirectHref).not.toBe(CUSTOM_BUILD_EDIT_WORKSPACE_HREF);
    }
  });

  it("opens custom-build projects in the editable Foundation workspace, not Customize/review", async () => {
    loadCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      project: sampleProject({
        name: "Sue's test pattern",
        source: "custom-build",
        pattern: {
          ...sampleProject().pattern,
          patternProject: { title: "Sue's test pattern", notes: "", titleCustomized: true },
        },
      }),
    });

    const result = await loadSavedCustomPatternProject(PROJECT_ID, "open");

    expect(result).toEqual({ ok: true, redirectHref: CUSTOM_BUILD_EDIT_WORKSPACE_HREF });
    if (result.ok) {
      expect(result.redirectHref).not.toBe(EXPRESS_CONTINUE_EDITING_HREF);
      expect(result.redirectHref).not.toContain("/custom-style");
      expect(result.redirectHref).not.toBe(OPEN_PATTERN_HREF);
    }
    expect(readActiveCustomPatternProjectId()).toBe(PROJECT_ID);
    expect(readActiveCustomPatternProjectLinkedName()).toBe("Sue's test pattern");
    expect(localStorage.getItem(PATTERN_STORAGE_KEY)).toContain("Sue's test pattern");
  });

  it("rehydrates Express builder storage during normal open", async () => {
    const safeSpy = vi.spyOn(restoreModule, "safeRestoreSleevelessExpressBuilderFromPattern");

    loadCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      project: sampleProject(),
    });

    await loadSavedCustomPatternProject(PROJECT_ID, "open");

    expect(safeSpy).toHaveBeenCalled();
    safeSpy.mockRestore();
  });

  it("prefills saved values (including gauge) and unlocks every step when opening for edit", async () => {
    loadCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      project: sampleProject(),
    });

    await loadSavedCustomPatternProject(PROJECT_ID, "open");

    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const snapshot = JSON.parse(raw ?? "{}");
    // Gauge from the saved project is prefilled so it can be edited without rebuilding.
    expect(snapshot.gaugeStitchRaw).toBe("22");
    expect(snapshot.gaugeRowRaw).toBe("28");
    // Saved sizing identity is restored into the wizard values.
    expect(snapshot.values?.selectedSize).toBe("M");
    expect(snapshot.values?.who).toBe("women");
    // Opened for edit: all steps unlocked + reopened so gauge is reachable immediately.
    expect(snapshot.editChoicesReopen).toBe(true);
    expect(snapshot.maxReachable).toBe(5);
  });

  it("links the active project to the opened (copied) project id, not a previously opened one", async () => {
    const original = sampleProject({ id: "proj-original", name: "Original" });
    loadCustomPatternProjectMock.mockResolvedValueOnce({ ok: true, project: original });
    await loadSavedCustomPatternProject("proj-original", "open");
    expect(readActiveCustomPatternProjectId()).toBe("proj-original");

    const copy = sampleProject({ id: "proj-original-copy", name: "Original - Copy" });
    loadCustomPatternProjectMock.mockResolvedValueOnce({ ok: true, project: copy });
    await loadSavedCustomPatternProject("proj-original-copy", "open");

    expect(readActiveCustomPatternProjectId()).toBe("proj-original-copy");
    expect(readActiveCustomPatternProjectLinkedName()).toBe("Original - Copy");
    expect(localStorage.getItem(PATTERN_STORAGE_KEY)).toContain("Original - Copy");
  });
});

describe("loadProjectIntoWorkingDraft", () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  it("loads draft even when pattern sections are null", () => {
    const project = sampleProject({
      pattern: {
        ...sampleProject().pattern,
        style: null as unknown as CustomPatternProject["pattern"]["style"],
        fit: null as unknown as CustomPatternProject["pattern"]["fit"],
      },
    });

    expect(() => loadProjectIntoWorkingDraft(project)).not.toThrow();
    expect(localStorage.getItem(PATTERN_STORAGE_KEY)).toContain("For Aubrie");
  });

  it("continues when reading workflow restore throws", () => {
    const workflowError = vi
      .spyOn(workflowModule, "applySleevelessReadingWorkflow")
      .mockImplementation(() => {
        throw new Error("workflow restore failed");
      });

    expect(() => loadProjectIntoWorkingDraft(sampleProject())).not.toThrow();
    expect(localStorage.getItem(PATTERN_STORAGE_KEY)).toContain("For Aubrie");

    workflowError.mockRestore();
  });
});

describe("safeRestoreSleevelessExpressBuilderFromPattern", () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  it("returns false when localStorage.setItem fails without throwing", () => {
    const setItem = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    expect(() =>
      restoreModule.safeRestoreSleevelessExpressBuilderFromPattern(sampleProject().pattern),
    ).not.toThrow();
    expect(
      restoreModule.safeRestoreSleevelessExpressBuilderFromPattern(sampleProject().pattern),
    ).toBe(false);

    setItem.mockRestore();
  });

  it("still writes builder snapshot when restore succeeds", () => {
    const project = sampleProject().pattern;
    localStorage.setItem(PATTERN_STORAGE_KEY, JSON.stringify(project));

    const ok = restoreModule.safeRestoreSleevelessExpressBuilderFromPattern(project);

    expect(ok).toBe(true);
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    expect(raw).toContain('"who":"women"');
  });
});
