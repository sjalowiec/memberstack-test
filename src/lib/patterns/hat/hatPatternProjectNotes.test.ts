import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "../test/stubLocalStorage";
import type { CustomPatternProject } from "../customPatternProjectTypes";
import { coerceHatDraft, createEmptyHatDraft, readHatDraft, writeHatDraft } from "./hatDraft";
import { persistHatPatternProject } from "./hatPatternProjectSave";
import {
  applyHatPatternNameToDraft,
  applyHatPatternProjectDetailsToDraft,
  hydrateHatSavedProject,
  resolveHatPatternProjectNotes,
  resolveHatSavedPatternName,
} from "./hatSavedProject";
import { resolveHatPatternPrintFields } from "./hatPatternPrintTitle";
import { PROJECT_NOTES_MAX_LENGTH } from "../sleevelessPatternProjectMeta";

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

const AUBRIE_NOTES = "Tension 7\nKnitPicks yarn\nTuck stitch #12\nMade for Aubrie";

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

function hatProject(overrides: Partial<CustomPatternProject> = {}): CustomPatternProject {
  const draft = hatDraft({
    patternProject: {
      title: "Aubrie's Green Hat",
      notes: AUBRIE_NOTES,
      titleCustomized: true,
    },
  });
  return {
    id: "proj-hat-notes-1",
    name: "Aubrie's Green Hat",
    family: "sleeveless",
    source: "express",
    notes: AUBRIE_NOTES,
    createdAt: "2026-08-15T00:00:00.000Z",
    updatedAt: "2026-08-15T00:00:00.000Z",
    version: 1,
    customOverrides: {},
    pattern: draft as unknown as CustomPatternProject["pattern"],
    ...overrides,
  };
}

describe("Hat pattern project notes", () => {
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

  it("saves a new Hat with custom title and notes", async () => {
    const draft = applyHatPatternProjectDetailsToDraft(hatDraft(), {
      title: "Aubrie's Green Hat",
      notes: AUBRIE_NOTES,
    });
    const created = await persistHatPatternProject({
      draft,
      name: "Aubrie's Green Hat",
      mode: "create",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const payload = vi.mocked(createCustomPatternProject).mock.calls[0]?.[0];
    expect(payload?.name).toBe("Aubrie's Green Hat");
    expect(payload?.notes).toBe(AUBRIE_NOTES);
    expect(payload?.pattern.patternProject).toEqual({
      title: "Aubrie's Green Hat",
      notes: AUBRIE_NOTES,
      titleCustomized: true,
    });
    expect(created.project.notes).toBe(AUBRIE_NOTES);
  });

  it("round-trips notes through draft serialization/storage", () => {
    const draft = applyHatPatternProjectDetailsToDraft(hatDraft(), {
      title: "Aubrie's Green Hat",
      notes: AUBRIE_NOTES,
    });
    writeHatDraft(draft);
    const raw = localStorage.getItem("kbm_hat_draft");
    expect(raw).toContain("Tension 7");
    const restored = readHatDraft();
    expect(resolveHatPatternProjectNotes(restored)).toBe(AUBRIE_NOTES);
    expect(restored?.patternProject?.title).toBe("Aubrie's Green Hat");
  });

  it("restores title and notes when reopening a saved Hat", () => {
    const opened = hydrateHatSavedProject(hatProject());
    expect(resolveHatSavedPatternName(opened)).toBe("Aubrie's Green Hat");
    expect(resolveHatPatternProjectNotes(opened)).toBe(AUBRIE_NOTES);
    expect(readHatDraft()?.patternProject?.notes).toBe(AUBRIE_NOTES);
    expect(resolveHatPatternPrintFields({ draft: opened })).toEqual({
      title: "Aubrie's Green Hat",
      notes: AUBRIE_NOTES,
    });
  });

  it("updates notes on a later save", async () => {
    const created = await persistHatPatternProject({
      draft: applyHatPatternProjectDetailsToDraft(hatDraft(), {
        title: "Aubrie's Green Hat",
        notes: AUBRIE_NOTES,
      }),
      name: "Aubrie's Green Hat",
      mode: "create",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const edited = applyHatPatternProjectDetailsToDraft(hatDraft(), {
      title: "Aubrie's Green Hat",
      notes: "Tension 6\nSoft merino",
    });
    const updated = await persistHatPatternProject({
      draft: edited,
      name: "Aubrie's Green Hat",
      mode: "update",
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updateCustomPatternProject).toHaveBeenCalledTimes(1);
    expect(updated.project.notes).toBe("Tension 6\nSoft merino");
    expect(updated.project.pattern.patternProject?.notes).toBe("Tension 6\nSoft merino");
    expect(updated.project.pattern.patternProject?.title).toBe("Aubrie's Green Hat");
  });

  it("loads existing Hat records that have no notes value", () => {
    const legacyPattern = {
      ...hatDraft({
        patternProject: { title: "Camp Hat", titleCustomized: true } as {
          title: string;
          titleCustomized: true;
        },
      }),
    };
    delete (legacyPattern.patternProject as { notes?: string }).notes;

    const coerced = coerceHatDraft(legacyPattern);
    expect(coerced?.patternProject?.title).toBe("Camp Hat");
    expect(coerced?.patternProject?.notes).toBe("");

    const project: CustomPatternProject = {
      id: "proj-hat-legacy",
      name: "Camp Hat",
      family: "sleeveless",
      source: "express",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      version: 1,
      customOverrides: {},
      pattern: legacyPattern as unknown as CustomPatternProject["pattern"],
    };
    expect(project.notes).toBeUndefined();

    const opened = hydrateHatSavedProject(project);
    expect(opened.patternProject?.title).toBe("Camp Hat");
    expect(opened.patternProject?.notes).toBe("");
    expect(resolveHatPatternProjectNotes(opened)).toBe("");
  });

  it("keeps custom Hat title behavior when notes are applied", () => {
    const named = applyHatPatternNameToDraft(hatDraft(), "  Camp Hat  ");
    expect(named.patternProject).toEqual({
      title: "Camp Hat",
      notes: "",
      titleCustomized: true,
    });
    const withNotes = applyHatPatternProjectDetailsToDraft(named, {
      notes: "Soft merino",
    });
    expect(withNotes.patternProject).toEqual({
      title: "Camp Hat",
      notes: "Soft merino",
      titleCustomized: true,
    });
    expect(applyHatPatternNameToDraft(named, "   ")).toBe(named);
  });

  it("truncates notes to the shared project notes budget", () => {
    const long = "x".repeat(PROJECT_NOTES_MAX_LENGTH + 40);
    const next = applyHatPatternProjectDetailsToDraft(hatDraft(), {
      title: "Camp Hat",
      notes: long,
    });
    expect(next.patternProject?.notes).toHaveLength(PROJECT_NOTES_MAX_LENGTH);
  });
});
