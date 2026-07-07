import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearActiveCustomPatternProjectId, readActiveCustomPatternProjectId, writeActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import { runUpdateActiveSavedCustomPattern } from "./customPatternEditingBannerActions";
import { resolveEffectiveHemDepthInches } from "./customBuildEffectiveHemDepth";
import {
  buildSavePayloadFromWorkingDraft,
  loadProjectIntoWorkingDraft,
  updateCustomPatternProject,
} from "./customPatternProjectClient";
import { getDefaultHemLengthInches } from "./hemDefaults";
import { smartSaveCustomPatternProject } from "./customPatternSavedProjectsPanel";
import {
  createSavedPatternUnsavedViewWorkflowDeps,
  runSavedPatternUnsavedViewWorkflow,
} from "./savedCustomPatternUnsavedViewGuard";
import { buildSleevelessGarmentDiagramReplacements } from "./sleevelessGarmentDiagramReplacements";
import {
  buildGeneratorPatternDataFromSources,
  mergedPatternForDisplayFromSources,
} from "./sleevelessPatternBuilderMerge";
import { calculateHemRowsFromInches } from "./hemDefaults";
import { validatePatternBuilderRequired } from "./patternBuilderValidation";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";

vi.mock("./customPatternProjectClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./customPatternProjectClient")>();
  return {
    ...actual,
    updateCustomPatternProject: vi.fn(),
  };
});

// Saving from the workspace is member/owner-gated. Stub an authorized member snapshot so the
// save path proceeds; all other client exports stay real. (Test-only — no production logic change.)
vi.mock("./sleevelessPatternSystemAccessClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./sleevelessPatternSystemAccessClient")>();
  return {
    ...actual,
    resolveSleevelessUserAccess: vi.fn().mockResolvedValue({
      loggedIn: true,
      memberId: "ms_member",
      hasSystemAccess: true,
      freeClaimsBySystem: {},
    }),
  };
});
import type { CustomPatternProject } from "./customPatternProjectTypes";
import {
  captureSavedCustomPatternDirtyBaseline,
  hasUnsavedSavedCustomPatternChanges,
} from "./customPatternSavedProjectDirtyState";
import { hydrateSavedCustomPatternProjectSession } from "./hydrateSavedCustomPatternProject";
import {
  flushCustomBuildMeasurementOverridesToCanonical,
  loadMeasurementOverrides,
  persistMeasurementOverrides,
  resolveCustomBuildSaveMeasureFlushRoot,
} from "./sleevelessCustomMeasurementStorage";
import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  savePatternData,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";
import { stubLocalStorage } from "./test/stubLocalStorage";

function customBuildProject(
  overrides: Record<string, string>,
  hemDepth = "2",
): CustomPatternProject {
  return {
    id: "proj-cb",
    name: "Custom build test",
    family: "sleeveless",
    source: "custom-build",
    notes: "",
    customOverrides: {},
    createdAt: "t1",
    updatedAt: "t2",
    version: 1,
    pattern: {
      id: "pattern-cb",
      patternType: "sleeveless",
      status: "draft",
      version: 1,
      createdAt: "t1",
      updatedAt: "t1",
      style: {
        patternMode: "custom-build",
        recipientCategory: "misses",
        bodyShape: "straight",
        frontStyle: "closed",
        garmentStyle: "pullover",
        neckline: "round",
      },
      fit: {
        selectedSize: "M",
        easeChoice: "standard",
        sizingChart: "misses",
        cbMeasurementOverrides: { ...overrides, hemDepth },
      },
      yarnGauge: { gaugeStitchRaw: "20", gaugeRowRaw: "26" },
      measurements: {},
      machine: {},
      calculations: {},
      instructions: {},
      patternProject: {
        title: "Custom build test",
        notes: "",
        titleCustomized: true,
      },
    },
  };
}

function overrideFromPayload(payload: ReturnType<typeof buildSavePayloadFromWorkingDraft>, key: string): string | undefined {
  const fit = payload.pattern.fit as Record<string, unknown>;
  const cb = fit.cbMeasurementOverrides as Record<string, string> | undefined;
  return cb?.[key];
}

/** Minimal ParentNode stub for Customize diagram inputs (no jsdom). */
function createCustomizeMeasureFlushRoot(
  values: Partial<Record<string, string>>,
): ParentNode {
  const inputs = new Map(
    Object.entries(values).map(([key, value]) => [
      key,
      { value, trim: () => value.trim() } as HTMLInputElement,
    ]),
  );
  const root = {
    querySelector(sel: string) {
      if (sel === "[data-cb-measure-root]") return root;
      const match = /data-cb-measure-input="([^"]+)"/.exec(sel);
      if (!match) return null;
      return inputs.get(match[1]) ?? null;
    },
    querySelectorAll() {
      return [];
    },
  };
  return root as unknown as ParentNode;
}

/** Saved-projects panel root without diagram — save must still find measure host on document. */
function createSavedProjectsPanelRoot(): ParentNode {
  return {
    querySelector(sel: string) {
      if (sel === "[data-cb-measure-root]") return null;
      if (sel === "[data-cb-project-name]") return { value: "Custom build test", trim: () => "Custom build test" };
      return null;
    },
    querySelectorAll() {
      return [];
    },
  } as unknown as ParentNode;
}

function stubDocumentMeasureRoot(measureRoot: ParentNode): () => void {
  const doc = {
    querySelector(sel: string) {
      if (sel === "[data-cb-measure-root]") return measureRoot;
      return null;
    },
    querySelectorAll() {
      return [];
    },
    dispatchEvent: vi.fn(),
    documentElement: {
      classList: {
        toggle: vi.fn(),
      },
    },
  };
  vi.stubGlobal("document", doc);
  // Node test env has no `HTMLElement`; production runs in the browser where it always exists.
  // Provide a stub so `x instanceof HTMLElement` guards in the save path don't throw. Mock roots
  // are plain objects, so `instanceof` stays false (the same branch a real non-element would take).
  if (typeof (globalThis as { HTMLElement?: unknown }).HTMLElement === "undefined") {
    vi.stubGlobal("HTMLElement", class MockHTMLElement {});
  }
  return () => vi.unstubAllGlobals();
}

describe("saved custom-build measurement save", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.mocked(updateCustomPatternProject).mockReset();
  });

  it("loads canonical overrides when express builder has no cbMeasurementOverrides", () => {
    const project = customBuildProject({
      chestBust: "40",
      finishedLength: "24",
    });
    hydrateSavedCustomPatternProjectSession(project);

    expect(loadMeasurementOverrides().hemDepth).toBe("2");
    expect(loadMeasurementOverrides().chestBust).toBe("40");
  });

  it("detects dirty after hip-only change (straight torso) and save payload includes updated hip", () => {
    const project = customBuildProject({
      chestBust: "40",
      finishedLength: "24",
      armholeDepth: "8",
      shoulderWidth: "14",
      finishedNeckOpeningWidth: "6",
      neckDepth: "3",
      hip: "40",
    });
    hydrateSavedCustomPatternProjectSession(project);
    captureSavedCustomPatternDirtyBaseline();
    expect(hasUnsavedSavedCustomPatternChanges()).toBe(false);

    persistMeasurementOverrides({
      ...loadMeasurementOverrides(),
      hip: "43",
    });

    expect(hasUnsavedSavedCustomPatternChanges()).toBe(true);
    expect(loadMeasurementOverrides().hip).toBe("43");

    flushCustomBuildMeasurementOverridesToCanonical();

    const payload = buildSavePayloadFromWorkingDraft(project.name);
    expect(overrideFromPayload(payload, "hip")).toBe("43");
    expect(overrideFromPayload(payload, "chestBust")).toBe("40");
  });

  it("save payload merges patternBuilderData selectedMeasurements when canonical fit omits them", () => {
    const project = customBuildProject({
      chestBust: "40",
      finishedLength: "24",
      armholeDepth: "8",
      shoulderWidth: "14",
      finishedNeckOpeningWidth: "6",
      neckDepth: "3",
      hip: "40",
    });
    hydrateSavedCustomPatternProjectSession(project);
    savePatternData("fit", {
      selectedSize: "M",
      easeChoice: "standard",
      fitChoice: "standard",
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 40,
        finished_hip: 40,
      },
    });
    saveCurrentPattern({
      fit: {
        selectedSize: "M",
        easeChoice: "standard",
        sizingChart: "misses",
        cbMeasurementOverrides: loadMeasurementOverrides(),
      },
    });

    const payload = buildSavePayloadFromWorkingDraft(project.name, {
      skipFlushMeasurementOverrides: true,
    });
    const fit = payload.pattern.fit as Record<string, unknown>;
    const sm = fit.selectedMeasurements as Record<string, number>;
    expect(sm.finished_bust_chest).toBe(40);
    expect(sm.finished_hip).toBe(40);
  });

  it("reload after update keeps pattern summary validation fields", () => {
    const project = customBuildProject({
      chestBust: "40",
      finishedLength: "24",
      armholeDepth: "8",
      shoulderWidth: "14",
      finishedNeckOpeningWidth: "6",
      neckDepth: "3",
      hip: "40",
    });
    hydrateSavedCustomPatternProjectSession(project);
    savePatternData("fit", {
      selectedSize: "M",
      easeChoice: "standard",
      fitChoice: "standard",
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 40,
        finished_hip: 40,
      },
    });
    savePatternData("yarnGaugeMachine", {
      gaugeStitchesPerInch: "7",
      gaugeRowsPerInch: "11",
      gaugeStitchRaw: "28",
      gaugeRowRaw: "44",
      gaugeRawUnit: "in",
      availableNeedles: "200",
    });
    saveCurrentPattern({
      fit: {
        selectedSize: "M",
        easeChoice: "standard",
        sizingChart: "misses",
        cbMeasurementOverrides: loadMeasurementOverrides(),
      },
      yarnGauge: { gaugeStitchRaw: "28", gaugeRowRaw: "44", gaugeRawUnit: "in" },
    });

    const payload = buildSavePayloadFromWorkingDraft(project.name, {
      skipFlushMeasurementOverrides: true,
    });
    loadProjectIntoWorkingDraft({
      ...project,
      pattern: payload.pattern,
    });

    const validation = validatePatternBuilderRequired(getPatternData());
    expect(validation.ok).toBe(true);
  });

  it("detects dirty after hemDepth change and save payload includes updated hemDepth", () => {
    const project = customBuildProject({
      chestBust: "40",
      finishedLength: "24",
      armholeDepth: "8",
      shoulderWidth: "14",
      finishedNeckOpeningWidth: "6",
      neckDepth: "3",
      hip: "40",
    });
    hydrateSavedCustomPatternProjectSession(project);
    captureSavedCustomPatternDirtyBaseline();
    expect(hasUnsavedSavedCustomPatternChanges()).toBe(false);

    persistMeasurementOverrides({
      ...loadMeasurementOverrides(),
      hemDepth: "3",
    });

    expect(hasUnsavedSavedCustomPatternChanges()).toBe(true);
    flushCustomBuildMeasurementOverridesToCanonical();

    const payload = buildSavePayloadFromWorkingDraft(project.name);
    expect(overrideFromPayload(payload, "hemDepth")).toBe("3");
    expect(getCurrentPattern().fit?.cbMeasurementOverrides).toMatchObject({ hemDepth: "3" });
    expect(
      (getPatternData().fit as Record<string, unknown>).cbMeasurementOverrides,
    ).toMatchObject({ hemDepth: "3" });

    const expressRaw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY) ?? "";
    expect(expressRaw).toContain('"hemDepth":"3"');
  });

  it("flushes visible hem depth from Customize DOM into save payload without blur", () => {
    const project = customBuildProject({
      chestBust: "40",
      finishedLength: "24",
      armholeDepth: "8",
      shoulderWidth: "14",
      finishedNeckOpeningWidth: "6",
      neckDepth: "3",
      hip: "40",
    });
    hydrateSavedCustomPatternProjectSession(project);
    const measureRoot = createCustomizeMeasureFlushRoot({ hemDepth: "3" });

    const payload = buildSavePayloadFromWorkingDraft(project.name, { flushRoot: measureRoot });
    expect(overrideFromPayload(payload, "hemDepth")).toBe("3");
    expect(getCurrentPattern().fit?.cbMeasurementOverrides).toMatchObject({ hemDepth: "3" });
  });

  it("smartSave update persists DOM hem depth (Save & View Pattern prompt path)", async () => {
    const project = customBuildProject({
      chestBust: "40",
      finishedLength: "24",
      armholeDepth: "8",
      shoulderWidth: "14",
      finishedNeckOpeningWidth: "6",
      neckDepth: "3",
      hip: "40",
    });
    hydrateSavedCustomPatternProjectSession(project);
    writeActiveCustomPatternProjectId(project.id, project.name);
    const measureRoot = createCustomizeMeasureFlushRoot({ hemDepth: "3" });

    vi.mocked(updateCustomPatternProject).mockResolvedValue({
      ok: true,
      project: {
        ...project,
        pattern: getCurrentPattern(),
      },
    });

    const res = await smartSaveCustomPatternProject({
      mode: "update",
      resolveName: () => project.name,
      root: measureRoot,
    });
    expect(res.ok).toBe(true);

    const sent = vi.mocked(updateCustomPatternProject).mock.calls.at(-1)?.[0];
    expect(
      (sent?.pattern.fit as Record<string, unknown>).cbMeasurementOverrides,
    ).toMatchObject({ hemDepth: "3" });
    expect(resolveEffectiveHemDepthInches(getPatternData(), "misses")).toBe(3);
    expect(resolveEffectiveHemDepthInches(getPatternData(), "misses")).not.toBe(
      getDefaultHemLengthInches("misses"),
    );
  });

  it("save-and-view workflow persists DOM hem depth before navigating to pattern", async () => {
    const project = customBuildProject({
      chestBust: "40",
      finishedLength: "24",
      armholeDepth: "8",
      shoulderWidth: "14",
      finishedNeckOpeningWidth: "6",
      neckDepth: "3",
      hip: "40",
    });
    hydrateSavedCustomPatternProjectSession(project);
    writeActiveCustomPatternProjectId(project.id, project.name);
    const measureRoot = createCustomizeMeasureFlushRoot({ hemDepth: "3" });

    vi.mocked(updateCustomPatternProject).mockResolvedValue({
      ok: true,
      project: {
        ...project,
        pattern: getCurrentPattern(),
      },
    });

    const navigate = vi.fn();
    const res = await runSavedPatternUnsavedViewWorkflow({
      hasUnsaved: () => true,
      promptUnsaved: async () => "save-and-view",
      saveActiveProject: async () => {
        const saveRes = await smartSaveCustomPatternProject({
          mode: "update",
          resolveName: () => project.name,
          root: measureRoot,
        });
        return saveRes.ok ? { ok: true } : { ok: false };
      },
      navigate,
      flushRoot: measureRoot,
    });

    expect(res).toBe("navigated");
    expect(navigate).toHaveBeenCalledTimes(1);
    const sent = vi.mocked(updateCustomPatternProject).mock.calls.at(-1)?.[0];
    expect(
      (sent?.pattern.fit as Record<string, unknown>).cbMeasurementOverrides,
    ).toMatchObject({ hemDepth: "3" });
    expect(resolveEffectiveHemDepthInches(getPatternData(), "misses")).toBe(3);
  });

  it("createSavedPatternUnsavedViewWorkflowDeps save-and-view uses edited hem depth in payload and generation", async () => {
    const project = customBuildProject({
      chestBust: "40",
      finishedLength: "24",
      armholeDepth: "8",
      shoulderWidth: "14",
      finishedNeckOpeningWidth: "6",
      neckDepth: "3",
      hip: "40",
    });
    hydrateSavedCustomPatternProjectSession(project);
    writeActiveCustomPatternProjectId(project.id, project.name);
    savePatternData("yarnGaugeMachine", {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    });
    captureSavedCustomPatternDirtyBaseline();

    const measureRoot = createCustomizeMeasureFlushRoot({ hemDepth: "4" });

    vi.mocked(updateCustomPatternProject).mockResolvedValue({
      ok: true,
      project: {
        ...project,
        pattern: getCurrentPattern(),
      },
    });

    const navigate = vi.fn();
    const deps = createSavedPatternUnsavedViewWorkflowDeps({
      href: "/patterns/sleeveless/pattern/?tab=pattern",
      root: measureRoot,
    });

    const res = await runSavedPatternUnsavedViewWorkflow({
      ...deps,
      hasUnsaved: () => true,
      promptUnsaved: async () => "save-and-view",
      navigate,
    });

    expect(res).toBe("navigated");
    expect(navigate).toHaveBeenCalledTimes(1);

    const sent = vi.mocked(updateCustomPatternProject).mock.calls.at(-1)?.[0];
    expect(
      (sent?.pattern.fit as Record<string, unknown>).cbMeasurementOverrides,
    ).toMatchObject({ hemDepth: "4" });

    const merged = mergedPatternForDisplayFromSources(getCurrentPattern(), getPatternData());
    const genInput = buildGeneratorPatternDataFromSources(merged, getPatternData(), getCurrentPattern());
    expect(resolveEffectiveHemDepthInches(genInput, "misses")).toBe(4);

    const result = generateSleevelessBackPattern(genInput);
    expect(result.debug.hemRows).toBe(calculateHemRowsFromInches(7, 4));

    const repl = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: genInput,
      measurementPiece: "front",
    });
    expect(repl.HEM_INCHES).toBe("4");
    expect(Number(repl.HEM_ROWS)).toBe(result.debug.hemRows);
  });

  it("save payload includes updated finishedNeckOpeningWidth after flush", () => {
    const project = customBuildProject({
      chestBust: "40",
      finishedLength: "24",
      armholeDepth: "8",
      shoulderWidth: "14",
      finishedNeckOpeningWidth: "6",
      neckDepth: "3",
      hip: "40",
    });
    loadProjectIntoWorkingDraft(project);
    writeActiveCustomPatternProjectId(project.id, project.name);

    persistMeasurementOverrides({
      ...loadMeasurementOverrides(),
      finishedNeckOpeningWidth: "7",
    });
    flushCustomBuildMeasurementOverridesToCanonical();

    const payload = buildSavePayloadFromWorkingDraft(project.name);
    expect(overrideFromPayload(payload, "finishedNeckOpeningWidth")).toBe("7");
  });

  it("runUpdateActiveSavedCustomPattern sends edited overrides without blur", async () => {
    const project = customBuildProject({
      chestBust: "40",
      finishedLength: "24",
      armholeDepth: "8",
      shoulderWidth: "14",
      finishedNeckOpeningWidth: "6",
      neckDepth: "3",
      hip: "40",
    });
    hydrateSavedCustomPatternProjectSession(project);
    writeActiveCustomPatternProjectId(project.id, project.name);

    const measureRoot = createCustomizeMeasureFlushRoot({
      hemDepth: "3",
      chestBust: "41",
      armholeDepth: "9",
      finishedLength: "25",
    });
    const unstubDocument = stubDocumentMeasureRoot(measureRoot);

    vi.mocked(updateCustomPatternProject).mockResolvedValue({
      ok: true,
      project: {
        ...project,
        pattern: getCurrentPattern(),
      },
    });

    try {
      const res = await runUpdateActiveSavedCustomPattern(measureRoot);
      expect(res.ok).toBe(true);

      const sent = vi.mocked(updateCustomPatternProject).mock.calls.at(-1)?.[0];
      const cb = (sent?.pattern.fit as Record<string, unknown>).cbMeasurementOverrides as Record<
        string,
        string
      >;
      expect(cb).toMatchObject({
        hemDepth: "3",
        chestBust: "41",
        armholeDepth: "9",
        finishedLength: "25",
      });
    } finally {
      unstubDocument();
    }
  });

  it("smartSave update from panel root still flushes diagram on document", async () => {
    const project = customBuildProject({
      chestBust: "40",
      finishedLength: "24",
      armholeDepth: "8",
      shoulderWidth: "14",
      finishedNeckOpeningWidth: "6",
      neckDepth: "3",
      hip: "40",
    });
    hydrateSavedCustomPatternProjectSession(project);
    writeActiveCustomPatternProjectId(project.id, project.name);

    const measureRoot = createCustomizeMeasureFlushRoot({ hemDepth: "4", chestBust: "42" });
    const panelRoot = createSavedProjectsPanelRoot();
    const unstubDocument = stubDocumentMeasureRoot(measureRoot);

    vi.mocked(updateCustomPatternProject).mockResolvedValue({
      ok: true,
      project: { ...project, pattern: getCurrentPattern() },
    });

    try {
      expect(resolveCustomBuildSaveMeasureFlushRoot(panelRoot)).toBe(measureRoot);

      const res = await smartSaveCustomPatternProject({
        mode: "update",
        resolveName: () => project.name,
        root: panelRoot,
      });
      expect(res.ok).toBe(true);

      const sent = vi.mocked(updateCustomPatternProject).mock.calls.at(-1)?.[0];
      expect(
        (sent?.pattern.fit as Record<string, unknown>).cbMeasurementOverrides,
      ).toMatchObject({ hemDepth: "4", chestBust: "42" });
    } finally {
      unstubDocument();
    }
  });

  it("reopen after save loads cbMeasurementOverrides into working draft", async () => {
    const project = customBuildProject({
      chestBust: "40",
      finishedLength: "24",
      armholeDepth: "8",
      shoulderWidth: "14",
      finishedNeckOpeningWidth: "6",
      neckDepth: "3",
      hip: "40",
    });
    hydrateSavedCustomPatternProjectSession(project);
    writeActiveCustomPatternProjectId(project.id, project.name);

    const measureRoot = createCustomizeMeasureFlushRoot({ hemDepth: "3", chestBust: "41" });
    vi.mocked(updateCustomPatternProject).mockImplementation(async (payload) => ({
      ok: true,
      project: {
        ...project,
        pattern: payload.pattern as CustomPatternProject["pattern"],
      },
    }));

    const saveRes = await smartSaveCustomPatternProject({
      mode: "update",
      resolveName: () => project.name,
      root: measureRoot,
    });
    expect(saveRes.ok).toBe(true);

    localStorage.clear();
    const savedFromApi = vi.mocked(updateCustomPatternProject).mock.calls.at(-1)?.[0];
    expect(savedFromApi?.pattern.fit).toMatchObject({
      cbMeasurementOverrides: { hemDepth: "3", chestBust: "41" },
    });

    hydrateSavedCustomPatternProjectSession({
      ...project,
      pattern: savedFromApi!.pattern as CustomPatternProject["pattern"],
    });

    expect(loadMeasurementOverrides()).toMatchObject({ hemDepth: "3", chestBust: "41" });
    expect(getCurrentPattern().fit?.cbMeasurementOverrides).toMatchObject({
      hemDepth: "3",
      chestBust: "41",
    });
  });

  it("smartSave update uses pinned activeProjectId when the localStorage link was cleared", async () => {
    const project = customBuildProject({
      chestBust: "40",
      finishedLength: "24",
      armholeDepth: "8",
      shoulderWidth: "14",
      finishedNeckOpeningWidth: "6",
      neckDepth: "3",
      hip: "40",
    });
    hydrateSavedCustomPatternProjectSession(project);
    writeActiveCustomPatternProjectId(project.id, project.name);

    vi.mocked(updateCustomPatternProject).mockResolvedValue({
      ok: true,
      project: { ...project, pattern: getCurrentPattern() },
    });

    clearActiveCustomPatternProjectId();

    const saveRes = await smartSaveCustomPatternProject({
      mode: "update",
      activeProjectId: project.id,
      resolveName: () => project.name,
    });

    expect(saveRes.ok).toBe(true);
    expect(vi.mocked(updateCustomPatternProject).mock.calls.at(-1)?.[0].id).toBe(project.id);
    expect(readActiveCustomPatternProjectId()).toBe(project.id);
  });
});
