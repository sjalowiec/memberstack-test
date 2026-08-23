import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stubLocalStorage } from "../test/stubLocalStorage";
import type { CustomPatternProject } from "../customPatternProjectTypes";
import { createEmptyHatDraft, writeHatDraft } from "./hatDraft";
import {
  isEditingSavedHatProject,
  readHatActiveProjectId,
} from "./hatSavedProject";
import {
  hatDraftAsSavePattern,
  hatSummaryShouldShowProjectDetails,
  persistHatPatternProject,
  resolveHatPatternPersistAction,
  resolveHatPatternPersistActionFromViewer,
  resolveHatSummaryAfterPersistNext,
} from "./hatPatternProjectSave";
import {
  buildProjectRecord,
  summaryFromProject,
} from "../../../../netlify/functions/lib/custom-pattern-projects-store.js";
import { resolvePatternSystemFromProject } from "../patternSystemId";
import {
  buildCustomPatternProjectDrawerLines,
  formatCustomPatternProjectType,
} from "../patternWorkspaceLibraryDrawer";
import {
  HAT_SUMMARY_PRIMARY_FROM_BUILDER_LABEL,
  HAT_SUMMARY_PRIMARY_FROM_EDIT_LABEL,
  HAT_SUMMARY_PRIMARY_SAVE_LABEL,
} from "./hatPatternNavigation";

vi.mock("../customPatternProjectClient", () => ({
  createCustomPatternProject: vi.fn(),
  updateCustomPatternProject: vi.fn(),
  loadCustomPatternProject: vi.fn(),
  listCustomPatternProjects: vi.fn(async () => ({ ok: true, projects: [] })),
}));

import {
  createCustomPatternProject,
  loadCustomPatternProject,
  updateCustomPatternProject,
} from "../customPatternProjectClient";

const summaryScript = readFileSync(resolve("src/scripts/hat-pattern-summary-page.ts"), "utf8");
const summaryPage = readFileSync(resolve("src/pages/patterns/hat/summary/index.astro"), "utf8");
const hatPatternPage = readFileSync(resolve("src/pages/patterns/hat/pattern.astro"), "utf8");
const hatPatternPageScript = readFileSync(resolve("src/scripts/hat-pattern-page.ts"), "utf8");

const SLEEVELESS_ONLY_PHASE_WARNING =
  "Only sleeveless pattern projects are supported in this phase.";

function hatDraft(partial?: Parameters<typeof createEmptyHatDraft>[0]) {
  return createEmptyHatDraft({
    sizeSel: "adult_woman",
    brimType: "single",
    brimLength: "2",
    crownShaping: "gathered",
    fit: "watchcap",
    ...partial,
  });
}

describe("Hat Save Pattern vs Update Pattern source of truth", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("uses the active Hat project id, not Summary/Edit entry path", () => {
    expect(
      resolveHatPatternPersistAction({
        hasMemberSavedProjectPrivileges: true,
        activeProjectId: null,
        entryPath: "from-finished-pattern",
      }),
    ).toMatchObject({
      kind: "save",
      label: HAT_SUMMARY_PRIMARY_SAVE_LABEL,
      persist: "create",
    });

    expect(
      resolveHatPatternPersistAction({
        hasMemberSavedProjectPrivileges: true,
        activeProjectId: "proj-hat-1",
        entryPath: "from-builder",
      }),
    ).toMatchObject({
      kind: "update",
      label: HAT_SUMMARY_PRIMARY_FROM_EDIT_LABEL,
      persist: "update",
    });
  });

  it("keeps guest Summary/Edit labels on the entry path (no persistent save/update)", () => {
    expect(
      resolveHatPatternPersistAction({
        hasMemberSavedProjectPrivileges: false,
        activeProjectId: null,
        entryPath: "from-builder",
      }),
    ).toMatchObject({
      kind: "view",
      label: HAT_SUMMARY_PRIMARY_FROM_BUILDER_LABEL,
      persist: "local-only",
    });

    expect(
      resolveHatPatternPersistAction({
        hasMemberSavedProjectPrivileges: false,
        activeProjectId: null,
        entryPath: "from-finished-pattern",
      }),
    ).toMatchObject({
      kind: "apply-local",
      label: HAT_SUMMARY_PRIMARY_FROM_EDIT_LABEL,
      persist: "local-only",
    });
  });

  it("treats a leftover project id as local-only for guests", () => {
    expect(
      resolveHatPatternPersistActionFromViewer({
        viewerAccessState: "loggedOut",
        activeProjectId: "proj-hat-1",
        entryPath: "from-finished-pattern",
      }).persist,
    ).toBe("local-only");
  });

  it("shows Name/Notes for members before the first save, and hides them for guests", () => {
    expect(hatSummaryShouldShowProjectDetails(true)).toBe(true);
    expect(hatSummaryShouldShowProjectDetails(false)).toBe(false);
    expect(summaryScript).toContain("hatSummaryShouldShowProjectDetails");
    expect(summaryScript).toContain("titleField.hidden = !showProjectDetails");
    expect(summaryScript).not.toMatch(
      /titleField\.hidden = ![\s\S]{0,40}isEditingSavedHatProject/,
    );
  });

  it("after member create/update stays on Summary/Edit unless View Updated Pattern", () => {
    expect(resolveHatSummaryAfterPersistNext("create")).toBe("confirm");
    expect(resolveHatSummaryAfterPersistNext("update")).toBe("confirm");
    expect(resolveHatSummaryAfterPersistNext("local-only")).toBe("guest-continue");
    expect(summaryScript).toContain("promptEditPatternSaveConfirmation");
    expect(summaryScript).toContain("resolveHatSummaryAfterPersistNext");
    const updateStart = summaryScript.indexOf("async function updatePattern");
    const cancelStart = summaryScript.indexOf("function cancelEdit");
    const updateFn = summaryScript.slice(
      updateStart,
      cancelStart > updateStart ? cancelStart : updateStart + 2500,
    );
    expect(updateFn).toContain("persistHatPatternProject");
    expect(updateFn).toContain('confirmationChoice === "view"');
    expect(updateFn).toContain("navigateAfterPrimarySuccess");
    expect(updateFn).not.toMatch(
      /applyPersistChrome\(\);\s*await continueAfterPersist\(\)/,
    );
  });

  it("guest View My Pattern still continues through lead capture, not the member confirmation", () => {
    const updateStart = summaryScript.indexOf("async function updatePattern");
    const cancelStart = summaryScript.indexOf("function cancelEdit");
    const updateFn = summaryScript.slice(
      updateStart,
      cancelStart > updateStart ? cancelStart : updateStart + 2500,
    );
    expect(updateFn).toContain("continueAfterPersist");
    expect(updateFn).toContain('=== "confirm"');
    expect(updateFn.indexOf("promptEditPatternSaveConfirmation")).toBeLessThan(
      updateFn.indexOf("continueAfterPersist"),
    );
    const bindStart = summaryScript.indexOf("bindHatLeadForm(root");
    const bindFn = summaryScript.slice(bindStart, bindStart + 220);
    expect(bindFn).toContain("writeCurrentSummaryDraft");
    expect(bindFn).toContain("navigateAfterPrimarySuccess");
    expect(bindFn).not.toContain("persistHatPatternProject");
    expect(bindFn).not.toContain("promptEditPatternSaveConfirmation");
  });
});

describe("Hat member save → update → same project lifecycle", () => {
  const store = new Map<string, CustomPatternProject>();

  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    store.clear();
    vi.clearAllMocks();

    vi.mocked(createCustomPatternProject).mockImplementation(async (payload) => {
      const project: CustomPatternProject = {
        id: `proj-hat-${store.size + 1}`,
        name: payload.name,
        family: payload.family ?? "sleeveless",
        source: payload.source ?? "express",
        notes: payload.notes ?? "",
        createdAt: "2026-08-15T00:00:00.000Z",
        updatedAt: "2026-08-15T00:00:00.000Z",
        version: 1,
        customOverrides: payload.customOverrides ?? {},
        pattern: payload.pattern,
      };
      store.set(project.id, project);
      return { ok: true, project };
    });

    vi.mocked(loadCustomPatternProject).mockImplementation(async (id) => {
      const project = store.get(id);
      if (!project) return { ok: false, error: "not found" };
      return { ok: true, project };
    });

    vi.mocked(updateCustomPatternProject).mockImplementation(async (payload) => {
      const previous = store.get(payload.id);
      if (!previous) return { ok: false, error: "not found" };
      const project: CustomPatternProject = {
        ...previous,
        name: payload.name,
        notes: payload.notes ?? previous.notes,
        pattern: payload.pattern,
        version: previous.version + 1,
        updatedAt: "2026-08-15T01:00:00.000Z",
      };
      store.set(payload.id, project);
      return { ok: true, project };
    });
  });

  it("member new Hat: Save Pattern creates an id, then Update Pattern updates that same project", async () => {
    writeHatDraft(hatDraft());
    expect(readHatActiveProjectId()).toBe("");
    expect(isEditingSavedHatProject()).toBe(false);

    const beforeSave = resolveHatPatternPersistActionFromViewer({
      viewerAccessState: "memberAccess",
      activeProjectId: readHatActiveProjectId(),
      entryPath: "from-finished-pattern",
    });
    expect(beforeSave.label).toBe("Save Pattern");
    expect(beforeSave.persist).toBe("create");

    const created = await persistHatPatternProject({
      draft: hatDraft(),
      mode: "create",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(createCustomPatternProject).toHaveBeenCalledTimes(1);
    const createPayload = vi.mocked(createCustomPatternProject).mock.calls[0]?.[0];
    expect(createPayload?.family).toBe("sleeveless");
    expect(createPayload?.pattern.patternType).toBe("hat");
    expect((createPayload?.pattern as { patternSystem?: string }).patternSystem).toBe("hat");
    expect(updateCustomPatternProject).not.toHaveBeenCalled();
    expect(readHatActiveProjectId()).toBe(created.project.id);
    expect(isEditingSavedHatProject()).toBe(true);

    const afterSave = resolveHatPatternPersistActionFromViewer({
      viewerAccessState: "memberAccess",
      activeProjectId: readHatActiveProjectId(),
      entryPath: "from-finished-pattern",
    });
    expect(afterSave.label).toBe("Update Pattern");
    expect(afterSave.persist).toBe("update");

    const updated = await persistHatPatternProject({
      draft: hatDraft({ brimLength: "2.5" }),
      name: created.project.name,
      mode: "update",
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;

    expect(createCustomPatternProject).toHaveBeenCalledTimes(1);
    expect(updateCustomPatternProject).toHaveBeenCalledTimes(1);
    expect(updated.project.id).toBe(created.project.id);
    expect(readHatActiveProjectId()).toBe(created.project.id);
    const pattern = updated.project.pattern as { brimLength?: string };
    expect(pattern.brimLength).toBe("2.5");
  });

  it("opening an existing saved Hat starts with Update Pattern and does not create", async () => {
    const created = await persistHatPatternProject({
      draft: hatDraft({ patternProject: { title: "Camp Hat", notes: "", titleCustomized: true } }),
      name: "Camp Hat",
      mode: "create",
    });
    expect(created.ok).toBe(true);
    vi.mocked(createCustomPatternProject).mockClear();

    const action = resolveHatPatternPersistActionFromViewer({
      viewerAccessState: "memberAccess",
      activeProjectId: readHatActiveProjectId(),
      entryPath: "from-finished-pattern",
    });
    expect(action.label).toBe("Update Pattern");
    expect(action.persist).toBe("update");

    const updated = await persistHatPatternProject({
      draft: hatDraft({
        brimLength: "3",
        patternProject: { title: "Camp Hat", notes: "", titleCustomized: true },
      }),
      name: "Camp Hat",
      mode: "update",
    });
    expect(updated.ok).toBe(true);
    expect(createCustomPatternProject).not.toHaveBeenCalled();
    expect(updateCustomPatternProject).toHaveBeenCalled();
  });

  it("does not let Update Pattern create a new project when no id exists", async () => {
    const res = await persistHatPatternProject({
      draft: hatDraft(),
      mode: "update",
    });
    expect(res.ok).toBe(false);
    expect(createCustomPatternProject).not.toHaveBeenCalled();
    expect(updateCustomPatternProject).not.toHaveBeenCalled();
    expect(readHatActiveProjectId()).toBe("");
  });

  it("guest persist stays local-only in the Summary/Edit wiring", () => {
    expect(summaryScript).toContain("persistHatPatternProject");
    expect(summaryScript).toContain("resolveHatPatternPersistActionFromViewer");
    expect(summaryScript).toContain("bindHatPatternWorkspaceAccessLifecycle");
    expect(summaryScript).not.toContain("smartSaveCustomPatternProject");
    expect(summaryScript).not.toContain("writeActiveCustomPatternProjectId");
  });

  it("first member save stamps the visible title and notes onto the draft before persist", () => {
    const writeStart = summaryScript.indexOf("function writeCurrentSummaryDraft");
    const updateStart = summaryScript.indexOf("async function updatePattern");
    const writeFn = summaryScript.slice(
      writeStart,
      updateStart > writeStart ? updateStart : writeStart + 2500,
    );
    expect(writeFn).toContain("requestedName");
    expect(writeFn).toContain("notesFieldApi.getNotes");
    expect(writeFn).toContain("applyHatPatternProjectDetailsToDraft");
    expect(writeFn).toContain("titleField && !titleField.hidden");
    expect(writeFn).not.toContain("isEditingSavedHatProject");
    expect(writeFn).not.toContain("persistHatPatternProject");
  });
});

describe("Hat Pattern page does not render the sleeveless-only save warning", () => {
  it("does not bake the leftover sleeveless-phase warning into Hat pages or save UI", () => {
    for (const src of [hatPatternPage, hatPatternPageScript, summaryPage, summaryScript]) {
      expect(src).not.toContain(SLEEVELESS_ONLY_PHASE_WARNING);
      expect(src).not.toContain("Only sleeveless pattern projects are supported");
    }
  });

  it("keeps the mobile Save Pattern error slot empty until a Hat-specific persist error", () => {
    expect(summaryPage).toContain('class="sl-edit-error-note"');
    expect(summaryPage).toContain("data-hat-edit-form-error");
    expect(summaryPage).toMatch(
      /class="sl-edit-error-note"[^>]*data-hat-edit-form-error[^>]*hidden/,
    );
    expect(summaryPage).not.toMatch(
      /data-hat-edit-form-error[^>]*>[\s\S]*sleeveless pattern projects/,
    );
    expect(summaryScript).toContain("persistRes.error");
    expect(summaryScript).toContain('showFieldErrors({ form: persistRes.error })');
  });
});

function hatDraftWithoutIdentity() {
  const draft = hatDraft({
    gaugeSlots: { inches: { stitch: "5", row: "7" }, cm: { stitch: "", row: "" } },
  }) as HatDraftMissingIdentity;
  delete draft.patternType;
  delete draft.patternSystem;
  return draft;
}

type HatDraftMissingIdentity = ReturnType<typeof hatDraft> & {
  patternType?: string;
  patternSystem?: string;
};

describe("Hat save payload always stamps Hat identity", () => {
  const store = new Map<string, CustomPatternProject>();

  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    store.clear();
    vi.clearAllMocks();

    vi.mocked(createCustomPatternProject).mockImplementation(async (payload) => {
      const project: CustomPatternProject = {
        id: `proj-hat-${store.size + 1}`,
        name: payload.name,
        family: payload.family ?? "sleeveless",
        source: payload.source ?? "express",
        notes: payload.notes ?? "",
        createdAt: "2026-08-22T00:00:00.000Z",
        updatedAt: "2026-08-22T00:00:00.000Z",
        version: 1,
        customOverrides: payload.customOverrides ?? {},
        pattern: payload.pattern,
      };
      store.set(project.id, project);
      return { ok: true, project };
    });

    vi.mocked(loadCustomPatternProject).mockImplementation(async (id) => {
      const project = store.get(id);
      if (!project) return { ok: false, error: "not found" };
      return { ok: true, project };
    });

    vi.mocked(updateCustomPatternProject).mockImplementation(async (payload) => {
      const previous = store.get(payload.id);
      if (!previous) return { ok: false, error: "not found" };
      const project: CustomPatternProject = {
        ...previous,
        name: payload.name,
        notes: payload.notes ?? previous.notes,
        pattern: payload.pattern,
        version: previous.version + 1,
        updatedAt: "2026-08-22T01:00:00.000Z",
      };
      store.set(payload.id, project);
      return { ok: true, project };
    });
  });

  it("saves a new Hat draft missing identity with patternType/patternSystem hat and family sleeveless", async () => {
    const created = await persistHatPatternProject({
      draft: hatDraftWithoutIdentity(),
      mode: "create",
    });
    expect(created.ok).toBe(true);

    const payload = vi.mocked(createCustomPatternProject).mock.calls[0]?.[0];
    expect(payload?.family).toBe("sleeveless");
    expect(payload?.pattern.patternType).toBe("hat");
    expect((payload?.pattern as { patternSystem?: string }).patternSystem).toBe("hat");
  });

  it("does not let an update strip Hat identity", async () => {
    const created = await persistHatPatternProject({
      draft: hatDraft(),
      name: "Camp Hat",
      mode: "create",
    });
    expect(created.ok).toBe(true);
    vi.mocked(createCustomPatternProject).mockClear();

    const updated = await persistHatPatternProject({
      draft: hatDraftWithoutIdentity(),
      name: "Camp Hat",
      mode: "update",
    });
    expect(updated.ok).toBe(true);
    expect(createCustomPatternProject).not.toHaveBeenCalled();

    const payload = vi.mocked(updateCustomPatternProject).mock.calls[0]?.[0];
    expect(payload?.family).toBe("sleeveless");
    expect(payload?.pattern.patternType).toBe("hat");
    expect((payload?.pattern as { patternSystem?: string }).patternSystem).toBe("hat");
  });

  it("still classifies a normal Sleeveless sweater payload as sleeveless", () => {
    const sweater = {
      id: "proj-sl",
      name: "Hat",
      family: "sleeveless" as const,
      source: "express" as const,
      createdAt: "2026-08-22T00:00:00.000Z",
      updatedAt: "2026-08-22T00:00:00.000Z",
      version: 1,
      pattern: { patternType: "sleeveless", style: {} },
      customOverrides: {},
    };
    expect(resolvePatternSystemFromProject(sweater)).toBe("sleeveless");
    expect(summaryFromProject(sweater).patternSystem).toBe("sleeveless");
    expect(
      formatCustomPatternProjectType({
        ...sweater,
        patternSystem: summaryFromProject(sweater).patternSystem,
      }),
    ).toBe("Sleeveless");
  });

  it("create → buildProjectRecord → index summary classifies as hat", () => {
    const pattern = hatDraftAsSavePattern(hatDraftWithoutIdentity());
    const built = buildProjectRecord(
      {
        name: "Camp Hat",
        family: "sleeveless",
        source: "express",
        pattern,
        customOverrides: {},
      },
      "user-1",
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    expect(built.project.family).toBe("sleeveless");
    expect(built.project.pattern.patternType).toBe("hat");
    expect(built.project.pattern.patternSystem).toBe("hat");

    const summary = summaryFromProject(built.project);
    expect(summary.patternSystem).toBe("hat");
    expect(summary.family).toBe("sleeveless");
  });

  it("My Patterns shows Hat and the saved gauge, not Sleeveless", () => {
    const pattern = hatDraftAsSavePattern(hatDraftWithoutIdentity());
    const built = buildProjectRecord(
      {
        name: "Camp Hat",
        family: "sleeveless",
        source: "express",
        pattern,
        customOverrides: {},
      },
      "user-1",
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const summary = summaryFromProject(built.project);
    expect(formatCustomPatternProjectType(summary)).toBe("Hat");
    expect(formatCustomPatternProjectType(summary)).not.toBe("Sleeveless");

    const lines = buildCustomPatternProjectDrawerLines({
      ...summary,
      updatedAt: "2026-08-22T00:00:00.000Z",
    });
    expect(lines.contextLine).toContain("Hat");
    expect(lines.contextLine).not.toContain("Sleeveless");
    expect(lines.gaugeLine).toBe("5 sts / 7 rows");
  });
});
