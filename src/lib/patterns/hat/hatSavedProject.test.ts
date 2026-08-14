import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "../test/stubLocalStorage";
import { resolveHatPatternPrintFields } from "./hatPatternPrintTitle";
import {
  readActiveCustomPatternProjectId,
  readActiveCustomPatternProjectLinkedName,
} from "../customPatternProjectActiveId";
import type { CustomPatternProject } from "../customPatternProjectTypes";
import { createEmptyHatDraft, readHatDraft, writeHatDraft } from "./hatDraft";
import {
  applyHatPatternNameToDraft,
  buildDefaultHatPatternTitle,
  HAT_PATTERN_FAMILY_NAME,
  hydrateHatSavedProject,
  isHatCustomPatternProject,
  resolveHatSavedPatternName,
} from "./hatSavedProject";
import { renameSavedCustomPatternProject } from "../savedCustomPatternManageActions";
import { getCurrentPattern, saveCurrentPattern } from "../patternStorage";

vi.mock("../customPatternProjectClient", () => ({
  loadCustomPatternProject: vi.fn(),
  updateCustomPatternProject: vi.fn(),
  listCustomPatternProjects: vi.fn(async () => ({ ok: true, projects: [] })),
  createCustomPatternProject: vi.fn(),
}));

import {
  loadCustomPatternProject,
  updateCustomPatternProject,
} from "../customPatternProjectClient";

function hatProject(name: string): CustomPatternProject {
  const draft = createEmptyHatDraft({
    sizeSel: "adult_woman",
    brimType: "single",
    brimLength: "2",
    crownShaping: "gathered",
    fit: "watchcap",
    patternProject: { title: name, notes: "", titleCustomized: true },
  });
  return {
    id: "proj-hat-1",
    name,
    family: "sleeveless",
    source: "express",
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    version: 1,
    customOverrides: {},
    pattern: draft as unknown as CustomPatternProject["pattern"],
  };
}

describe("saved hat naming", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("uses the shared family-only default name (Hat), not an elaborate auto title", () => {
    expect(HAT_PATTERN_FAMILY_NAME).toBe("Hat");
    expect(buildDefaultHatPatternTitle()).toBe("Hat");
  });

  it("detects hat saved projects without treating sweaters as hats", () => {
    expect(isHatCustomPatternProject(hatProject("Hat"))).toBe(true);
    expect(
      isHatCustomPatternProject({
        pattern: { patternType: "sleeveless", style: {} },
      }),
    ).toBe(false);
  });

  it("hydrates a renamed hat into kbm_hat_draft and the active project link (reopen)", () => {
    saveCurrentPattern({ patternProject: { title: "Women's Sleeveless", notes: "" } });
    const project = hatProject("Sue's Hiking Hat");
    const draft = hydrateHatSavedProject(project);

    expect(draft.patternProject?.title).toBe("Sue's Hiking Hat");
    expect(draft.patternProject?.titleCustomized).toBe(true);
    expect(readHatDraft()?.patternProject?.title).toBe("Sue's Hiking Hat");
    expect(readActiveCustomPatternProjectId()).toBe("proj-hat-1");
    expect(readActiveCustomPatternProjectLinkedName()).toBe("Sue's Hiking Hat");
    expect(getCurrentPattern().patternProject?.title).toBe("Women's Sleeveless");
  });

  it("keeps the renamed name after a second hydrate (reopen later)", () => {
    hydrateHatSavedProject(hatProject("Sue's Hiking Hat"));
    localStorage.removeItem("kbm_hat_draft");
    const again = hydrateHatSavedProject(hatProject("Sue's Hiking Hat"));
    expect(again.patternProject?.title).toBe("Sue's Hiking Hat");
    expect(resolveHatSavedPatternName(again)).toBe("Sue's Hiking Hat");
    expect(resolveHatPatternPrintFields({ draft: again })).toEqual({
      title: "Sue's Hiking Hat",
      notes: "",
    });
  });
});

describe("saved hat workspace title field", () => {
  it("reuses the sweater Pattern title field on the hat Summary/Edit page when saved", () => {
    const summaryPage = readFileSync(resolve("src/pages/patterns/hat/summary/index.astro"), "utf8");
    const summaryScript = readFileSync(resolve("src/scripts/hat-pattern-summary-page.ts"), "utf8");
    expect(summaryPage).toContain("data-hat-edit-title");
    expect(summaryPage).toContain("Pattern title");
    expect(summaryPage).toContain("data-hat-edit-title-field hidden");
    expect(summaryScript).toContain("applyHatPatternNameToDraft");
    expect(summaryScript).toContain("renameSavedCustomPatternProject");
    expect(summaryScript).toContain("titleField.hidden = !saved");
  });
});

describe("renameSavedCustomPatternProject for hats", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renames a saved hat in place using the same helper as sweaters", async () => {
    const project = hatProject("Hat");
    vi.mocked(loadCustomPatternProject).mockResolvedValue({ ok: true, project });
    vi.mocked(updateCustomPatternProject).mockImplementation(async (payload) => ({
      ok: true,
      project: { ...project, name: payload.name },
    }));

    const res = await renameSavedCustomPatternProject("proj-hat-1", "Sue's Hiking Hat");

    expect(res.ok).toBe(true);
    const payload = vi.mocked(updateCustomPatternProject).mock.calls[0]?.[0];
    expect(payload?.id).toBe("proj-hat-1");
    expect(payload?.name).toBe("Sue's Hiking Hat");
    expect(payload?.pattern.patternProject?.title).toBe("Sue's Hiking Hat");
    expect(payload?.pattern.patternProject?.titleCustomized).toBe(true);
    expect((payload?.pattern as { patternType?: string }).patternType).toBe("hat");
    expect((payload?.pattern as { brimType?: string }).brimType).toBe("single");
  });

  it("does not unique-check duplicate names on rename (same as sweaters)", async () => {
    const project = hatProject("Hat");
    vi.mocked(loadCustomPatternProject).mockResolvedValue({ ok: true, project });
    vi.mocked(updateCustomPatternProject).mockImplementation(async (payload) => ({
      ok: true,
      project: { ...project, name: payload.name },
    }));

    const res = await renameSavedCustomPatternProject("proj-hat-1", "Hat");
    expect(res.ok).toBe(true);
    expect(vi.mocked(updateCustomPatternProject).mock.calls[0]?.[0]?.name).toBe("Hat");
  });
});

describe("applyHatPatternNameToDraft", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("pins titleCustomized so the saved name is not treated as temporary", () => {
    const next = applyHatPatternNameToDraft(createEmptyHatDraft(), "  Camp Hat  ");
    expect(next.patternProject).toEqual({
      title: "Camp Hat",
      notes: "",
      titleCustomized: true,
    });
  });

  it("does not require a name on an unsaved empty draft", () => {
    const empty = createEmptyHatDraft();
    expect(applyHatPatternNameToDraft(empty, "   ")).toBe(empty);
    expect(empty.patternProject).toBeUndefined();
    writeHatDraft(empty);
    expect(readHatDraft()?.patternProject).toBeUndefined();
  });
});
