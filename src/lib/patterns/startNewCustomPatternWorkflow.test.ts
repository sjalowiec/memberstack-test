import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearActiveCustomPatternProjectId,
  readActiveCustomPatternProjectId,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import { createCustomPatternProject, updateCustomPatternProject } from "./customPatternProjectClient";
import {
  applyStartNewCustomPatternSession,
  buildNewPatternUnsavedDialogPanelHtml,
  NEW_PATTERN_UNSAVED_BODY,
  NEW_PATTERN_UNSAVED_FALLBACK_HINT,
  NEW_PATTERN_UNSAVED_TITLE,
  runStartNewCustomPatternWorkflow,
  startNewCustomPatternFromExpress,
} from "./startNewCustomPatternWorkflow";
import { smartSaveCustomPatternProject } from "./customPatternSavedProjectsPanel";
import {
  captureSavedCustomPatternDirtyBaseline,
  hasUnsavedSavedCustomPatternChanges,
} from "./customPatternSavedProjectDirtyState";
import { getCurrentPattern, saveCurrentPattern } from "./patternStorage";
import { getPatternProjectMeta } from "./sleevelessPatternProjectMeta";
import { stubLocalStorage } from "./test/stubLocalStorage";

vi.mock("./customPatternProjectClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./customPatternProjectClient")>();
  return {
    ...actual,
    createCustomPatternProject: vi.fn(),
    updateCustomPatternProject: vi.fn(),
  };
});

const savedProject = {
  id: "proj-sue",
  name: "Sue's test pattern",
  family: "sleeveless" as const,
  source: "express" as const,
  notes: "",
  pattern: {
    id: "pattern-1",
    patternType: "sleeveless" as const,
    status: "draft" as const,
    version: 1,
    createdAt: "t1",
    updatedAt: "t1",
    style: { patternMode: "express", garmentStyle: "pullover" },
    fit: {},
    yarnGauge: {},
    measurements: {},
    machine: {},
    calculations: {},
    instructions: {},
    patternProject: { title: "Sue's test pattern", notes: "", titleCustomized: true },
  },
  customOverrides: {},
  createdAt: "t1",
  updatedAt: "t2",
};

describe("New Pattern unsaved dialog copy", () => {
  it("uses the designed title, body, and button labels", () => {
    const html = buildNewPatternUnsavedDialogPanelHtml();
    expect(html).toContain(NEW_PATTERN_UNSAVED_TITLE);
    expect(html).toContain(NEW_PATTERN_UNSAVED_BODY);
    expect(html).toContain("Save &amp; Start New");
    expect(html).toContain("Start New Without Saving");
    expect(html).toContain("Cancel");
    expect(html).not.toContain("OK");
    expect(html).not.toContain("confirm(");
  });

  it("includes a clear fallback hint when overlay mode is used", () => {
    expect(NEW_PATTERN_UNSAVED_FALLBACK_HINT).toMatch(/unsaved edits/i);
    expect(NEW_PATTERN_UNSAVED_FALLBACK_HINT).toMatch(/lost/i);
  });
});

describe("runStartNewCustomPatternWorkflow", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("clears the active saved pattern id when starting new without unsaved changes", async () => {
    writeActiveCustomPatternProjectId("proj-sue", savedProject.name);
    saveCurrentPattern({
      patternProject: { title: savedProject.name, notes: "", titleCustomized: true },
    });

    const applyFreshSession = vi.fn(applyStartNewCustomPatternSession);
    const navigate = vi.fn();

    const result = await runStartNewCustomPatternWorkflow({
      hasUnsaved: () => false,
      promptUnsaved: vi.fn(),
      saveActiveProject: vi.fn(),
      applyFreshSession,
      navigate,
    });

    expect(result).toBe("started");
    expect(applyFreshSession).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(readActiveCustomPatternProjectId()).toBe("");
    expect(getPatternProjectMeta().title).toBe("");
  });

  it("prompts when there are unsaved changes", async () => {
    writeActiveCustomPatternProjectId("proj-sue", savedProject.name);
    const promptUnsaved = vi.fn().mockResolvedValue("cancel");

    const result = await runStartNewCustomPatternWorkflow({
      hasUnsaved: () => true,
      promptUnsaved,
      saveActiveProject: vi.fn(),
      applyFreshSession: vi.fn(),
      navigate: vi.fn(),
    });

    expect(result).toBe("cancelled");
    expect(promptUnsaved).toHaveBeenCalledTimes(1);
    expect(readActiveCustomPatternProjectId()).toBe("proj-sue");
  });

  it("Save & Start New saves first then resets", async () => {
    writeActiveCustomPatternProjectId("proj-sue", savedProject.name);
    saveCurrentPattern({
      style: { patternMode: "express", garmentStyle: "pullover" },
      patternProject: { title: savedProject.name, notes: "", titleCustomized: true },
    });
    captureSavedCustomPatternDirtyBaseline();
    saveCurrentPattern({
      style: { patternMode: "express", garmentStyle: "cardigan" },
      patternProject: { title: savedProject.name, notes: "changed", titleCustomized: true },
    });
    expect(hasUnsavedSavedCustomPatternChanges()).toBe(true);

    vi.mocked(updateCustomPatternProject).mockResolvedValue({
      ok: true,
      project: { ...savedProject, pattern: getCurrentPattern() },
    });

    const applyFreshSession = vi.fn(applyStartNewCustomPatternSession);
    const navigate = vi.fn();

    const result = await runStartNewCustomPatternWorkflow({
      hasUnsaved: hasUnsavedSavedCustomPatternChanges,
      promptUnsaved: vi.fn().mockResolvedValue("save-and-new"),
      saveActiveProject: async () => {
        const res = await smartSaveCustomPatternProject({
          mode: "update",
          resolveName: () => savedProject.name,
        });
        return res.ok ? { ok: true } : { ok: false };
      },
      applyFreshSession,
      navigate,
    });

    expect(result).toBe("started");
    expect(updateCustomPatternProject).toHaveBeenCalledTimes(1);
    expect(applyFreshSession).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(readActiveCustomPatternProjectId()).toBe("");
  });

  it("Start New Without Saving resets without saving", async () => {
    writeActiveCustomPatternProjectId("proj-sue", savedProject.name);
    saveCurrentPattern({
      style: { patternMode: "express", garmentStyle: "pullover" },
      patternProject: { title: savedProject.name, notes: "", titleCustomized: true },
    });
    captureSavedCustomPatternDirtyBaseline();
    saveCurrentPattern({
      style: { patternMode: "express", garmentStyle: "cardigan" },
      patternProject: { title: savedProject.name, notes: "changed", titleCustomized: true },
    });

    const applyFreshSession = vi.fn(applyStartNewCustomPatternSession);
    const navigate = vi.fn();

    const result = await runStartNewCustomPatternWorkflow({
      hasUnsaved: hasUnsavedSavedCustomPatternChanges,
      promptUnsaved: vi.fn().mockResolvedValue("discard-and-new"),
      saveActiveProject: vi.fn(),
      applyFreshSession,
      navigate,
    });

    expect(result).toBe("started");
    expect(updateCustomPatternProject).not.toHaveBeenCalled();
    expect(applyFreshSession).toHaveBeenCalledTimes(1);
    expect(readActiveCustomPatternProjectId()).toBe("");
  });

  it("Cancel leaves the active saved pattern untouched", async () => {
    writeActiveCustomPatternProjectId("proj-sue", savedProject.name);
    saveCurrentPattern({
      style: { patternMode: "express", garmentStyle: "pullover" },
      patternProject: { title: savedProject.name, notes: "", titleCustomized: true },
    });
    captureSavedCustomPatternDirtyBaseline();
    saveCurrentPattern({
      style: { patternMode: "express", garmentStyle: "cardigan" },
      patternProject: { title: savedProject.name, notes: "changed", titleCustomized: true },
    });

    const result = await runStartNewCustomPatternWorkflow({
      hasUnsaved: hasUnsavedSavedCustomPatternChanges,
      promptUnsaved: vi.fn().mockResolvedValue("cancel"),
      saveActiveProject: vi.fn(),
      applyFreshSession: vi.fn(),
      navigate: vi.fn(),
    });

    expect(result).toBe("cancelled");
    expect(readActiveCustomPatternProjectId()).toBe("proj-sue");
    expect(hasUnsavedSavedCustomPatternChanges()).toBe(true);
  });

  it("next save after New Pattern creates a new project, not an update", async () => {
    writeActiveCustomPatternProjectId("proj-sue", savedProject.name);
    saveCurrentPattern({
      patternProject: { title: savedProject.name, notes: "", titleCustomized: true },
    });

    await runStartNewCustomPatternWorkflow({
      hasUnsaved: () => false,
      promptUnsaved: vi.fn(),
      saveActiveProject: vi.fn(),
      applyFreshSession: applyStartNewCustomPatternSession,
      navigate: vi.fn(),
    });

    expect(readActiveCustomPatternProjectId()).toBe("");

    const secondProject = {
      ...savedProject,
      id: "proj-new",
      name: "Brand new vest",
    };
    vi.mocked(createCustomPatternProject).mockResolvedValue({
      ok: true,
      project: secondProject,
    });

    const res = await smartSaveCustomPatternProject({
      mode: "create",
      resolveName: () => secondProject.name,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.created).toBe(true);
    expect(createCustomPatternProject).toHaveBeenCalledTimes(1);
    expect(updateCustomPatternProject).not.toHaveBeenCalled();
    expect(readActiveCustomPatternProjectId()).toBe("proj-new");
  });

  it("does not start new when Save & Start New fails", async () => {
    writeActiveCustomPatternProjectId("proj-sue", savedProject.name);

    const applyFreshSession = vi.fn();
    const navigate = vi.fn();

    const result = await runStartNewCustomPatternWorkflow({
      hasUnsaved: () => true,
      promptUnsaved: vi.fn().mockResolvedValue("save-and-new"),
      saveActiveProject: vi.fn().mockResolvedValue({ ok: false }),
      applyFreshSession,
      navigate,
    });

    expect(result).toBe("cancelled");
    expect(applyFreshSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(readActiveCustomPatternProjectId()).toBe("proj-sue");
  });
});

describe("runStartNewCustomPatternWorkflow access gate", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("blocks a locked free user before clearing draft state, prompting, or navigating", async () => {
    writeActiveCustomPatternProjectId("proj-sue", savedProject.name);
    saveCurrentPattern({
      patternProject: { title: savedProject.name, notes: "", titleCustomized: true },
    });

    const onBlocked = vi.fn();
    const hasUnsaved = vi.fn(() => false);
    const promptUnsaved = vi.fn();
    const applyFreshSession = vi.fn();
    const navigate = vi.fn();

    const result = await runStartNewCustomPatternWorkflow({
      canStartNew: () => false,
      onBlocked,
      hasUnsaved,
      promptUnsaved,
      saveActiveProject: vi.fn(),
      applyFreshSession,
      navigate,
    });

    expect(result).toBe("blocked");
    expect(onBlocked).toHaveBeenCalledTimes(1);
    // The gate runs first: nothing downstream fires, so no setup questions are reached.
    expect(hasUnsaved).not.toHaveBeenCalled();
    expect(promptUnsaved).not.toHaveBeenCalled();
    expect(applyFreshSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    // The existing saved pattern stays linked, so it can still be opened / printed.
    expect(readActiveCustomPatternProjectId()).toBe("proj-sue");
  });

  it("lets a free user start their one free pattern when the gate allows it", async () => {
    writeActiveCustomPatternProjectId("proj-sue", savedProject.name);
    const applyFreshSession = vi.fn(applyStartNewCustomPatternSession);
    const navigate = vi.fn();

    const result = await runStartNewCustomPatternWorkflow({
      canStartNew: () => true,
      onBlocked: vi.fn(),
      hasUnsaved: () => false,
      promptUnsaved: vi.fn(),
      saveActiveProject: vi.fn(),
      applyFreshSession,
      navigate,
    });

    expect(result).toBe("started");
    expect(applyFreshSession).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(readActiveCustomPatternProjectId()).toBe("");
  });

  it("lets a member start a new pattern (async gate resolves true)", async () => {
    const applyFreshSession = vi.fn(applyStartNewCustomPatternSession);
    const navigate = vi.fn();

    const result = await runStartNewCustomPatternWorkflow({
      canStartNew: async () => true,
      hasUnsaved: () => false,
      promptUnsaved: vi.fn(),
      saveActiveProject: vi.fn(),
      applyFreshSession,
      navigate,
    });

    expect(result).toBe("started");
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});

describe("Express Start Over (shared workflow)", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("resets Express UI in place when nothing is dirty (no prompt)", async () => {
    const onExpressUiReset = vi.fn();
    const promptUnsaved = vi.fn();

    const result = await runStartNewCustomPatternWorkflow({
      hasUnsaved: () => false,
      promptUnsaved,
      saveActiveProject: vi.fn(),
      applyFreshSession: applyStartNewCustomPatternSession,
      navigate: onExpressUiReset,
    });

    expect(result).toBe("started");
    expect(promptUnsaved).not.toHaveBeenCalled();
    expect(onExpressUiReset).toHaveBeenCalledTimes(1);
    expect(readActiveCustomPatternProjectId()).toBe("");
  });

  it("does not reset Express UI when the user cancels the unsaved dialog", async () => {
    writeActiveCustomPatternProjectId("proj-sue", savedProject.name);
    saveCurrentPattern({
      style: { patternMode: "express", garmentStyle: "pullover" },
      patternProject: { title: savedProject.name, notes: "", titleCustomized: true },
    });
    captureSavedCustomPatternDirtyBaseline();
    saveCurrentPattern({
      style: { patternMode: "express", garmentStyle: "cardigan" },
      patternProject: { title: savedProject.name, notes: "changed", titleCustomized: true },
    });

    const onExpressUiReset = vi.fn();

    const result = await runStartNewCustomPatternWorkflow({
      hasUnsaved: hasUnsavedSavedCustomPatternChanges,
      promptUnsaved: vi.fn().mockResolvedValue("cancel"),
      saveActiveProject: vi.fn(),
      applyFreshSession: applyStartNewCustomPatternSession,
      navigate: onExpressUiReset,
    });

    expect(result).toBe("cancelled");
    expect(onExpressUiReset).not.toHaveBeenCalled();
    expect(readActiveCustomPatternProjectId()).toBe("proj-sue");
  });

  it("exports startNewCustomPatternFromExpress for the Express page script", () => {
    expect(typeof startNewCustomPatternFromExpress).toBe("function");
  });
});

describe("sleeveless-express-page Start Over", () => {
  it("does not use window.confirm for Express Start Over", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(dir, "../../scripts/sleeveless-express-page.ts"), "utf-8");

    expect(src).not.toContain("window.confirm");
    expect(src).not.toContain("Start a new pattern? Your current sleeveless choices");
    expect(src).toContain("startNewCustomPatternFromExpress");
    expect(src).toContain("requestResetExpressBuilder");
  });

  it("gates the ?new=1 deep link before showing the setup questions", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(dir, "../../scripts/sleeveless-express-page.ts"), "utf-8");

    // The new-session gate must run before initExpressPage (which clears + renders the wizard).
    expect(src).toContain("blockExpressNewPatternStartIfLocked");
    expect(src).toContain("isSleevelessExpressNewSessionSearchParams");
    expect(src).toContain("showSleevelessNewPatternLockedScreen");
    const gateIdx = src.indexOf("blockExpressNewPatternStartIfLocked().then");
    const initIdx = src.indexOf("initExpressPage();");
    expect(gateIdx).toBeGreaterThan(-1);
    expect(initIdx).toBeGreaterThan(gateIdx);
  });
});

