import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "../test/stubLocalStorage";
import {
  resolveHatPatternOnlineHeading,
  resolveHatPatternPrintFields,
} from "./hatPatternPrintTitle";
import {
  readActiveCustomPatternProjectId,
  readActiveCustomPatternProjectLinkedName,
  writeActiveCustomPatternProjectId,
} from "../customPatternProjectActiveId";
import type { CustomPatternProject } from "../customPatternProjectTypes";
import { createEmptyHatDraft, readHatDraft, writeHatDraft } from "./hatDraft";
import { startOverHatBuilderSession, startFreshHatPattern } from "./hatFreshStart";
import {
  applyHatPatternNameToDraft,
  buildDefaultHatPatternTitle,
  HAT_ACTIVE_PROJECT_ID_KEY,
  HAT_ACTIVE_PROJECT_NAME_KEY,
  HAT_PATTERN_FAMILY_NAME,
  hydrateHatSavedProject,
  isEditingSavedHatProject,
  isHatCustomPatternProject,
  readHatActiveProjectId,
  readHatActiveProjectLinkedName,
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

  it("hydrates a renamed hat into kbm_hat_draft and the hat-only active project link (reopen)", () => {
    saveCurrentPattern({ patternProject: { title: "Women's Sleeveless", notes: "" } });
    writeActiveCustomPatternProjectId("proj-sweater-1", "Women's Sleeveless");
    const project = hatProject("Sue's Hiking Hat");
    const draft = hydrateHatSavedProject(project);

    expect(draft.patternProject?.title).toBe("Sue's Hiking Hat");
    expect(draft.patternProject?.titleCustomized).toBe(true);
    expect(readHatDraft()?.patternProject?.title).toBe("Sue's Hiking Hat");
    expect(readHatActiveProjectId()).toBe("proj-hat-1");
    expect(readHatActiveProjectLinkedName()).toBe("Sue's Hiking Hat");
    expect(isEditingSavedHatProject()).toBe(true);
    expect(readActiveCustomPatternProjectId()).toBe("proj-sweater-1");
    expect(readActiveCustomPatternProjectLinkedName()).toBe("Women's Sleeveless");
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
    expect(summaryScript).toContain("persistHatPatternProject");
    expect(summaryScript).toContain("isEditingSavedHatProject");
    expect(summaryScript).toContain("readHatActiveProjectId");
    expect(summaryScript).not.toContain("isEditingSavedCustomPatternProject");
    expect(summaryScript).toContain("titleField.hidden = !saved");
    expect(summaryPage).toContain("pattern-editable-pencil.css");
    expect(summaryPage).toContain("pattern-editable-heading");
    expect(summaryPage).toContain("PatternEditablePencilIcon");
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

describe("hat vs sweater saved-project isolation", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  function openSweaterNamedWalts(): void {
    saveCurrentPattern({
      patternType: "sleeveless",
      patternProject: {
        title: "Walt's Men's Sleeveless",
        notes: "",
        titleCustomized: true,
      },
    });
    writeActiveCustomPatternProjectId("proj-walt-sleeveless", "Walt's Men's Sleeveless");
  }

  it("does not inherit a previously opened sweater id or title when entering the Hat flow", () => {
    openSweaterNamedWalts();
    writeHatDraft(createEmptyHatDraft({ sizeSel: "adult_woman" }));

    const draft = readHatDraft();
    expect(resolveHatSavedPatternName(draft)).toBe("");
    expect(isEditingSavedHatProject()).toBe(false);
    expect(readHatActiveProjectId()).toBe("");
    expect(resolveHatPatternPrintFields({ draft })).toEqual({ title: "Hat Pattern", notes: "" });
    expect(resolveHatPatternOnlineHeading('Adult Woman — 20.5" finished', draft)).toBe(
      'Hat Pattern · Adult Woman — 20.5" finished',
    );
    expect(resolveHatSavedPatternName(draft)).not.toBe("Walt's Men's Sleeveless");
    expect(readActiveCustomPatternProjectLinkedName()).toBe("Walt's Men's Sleeveless");
    expect(getCurrentPattern().patternProject?.title).toBe("Walt's Men's Sleeveless");
  });

  it("shows and prints the saved Hat name after open → rename, not the leftover sweater title", () => {
    openSweaterNamedWalts();
    const opened = hydrateHatSavedProject(hatProject("Camp Hat"));
    expect(resolveHatSavedPatternName(opened)).toBe("Camp Hat");
    expect(isEditingSavedHatProject()).toBe(true);

    const renamed = applyHatPatternNameToDraft(opened, "Trail Hat");
    writeHatDraft(renamed);
    expect(resolveHatSavedPatternName(renamed)).toBe("Trail Hat");
    expect(resolveHatPatternPrintFields({ draft: renamed })).toEqual({
      title: "Trail Hat",
      notes: "",
    });
    expect(resolveHatPatternOnlineHeading("Adult woman", renamed)).toBe("Trail Hat");
    expect(getCurrentPattern().patternProject?.title).toBe("Walt's Men's Sleeveless");
  });

  it("Start Over from a saved Hat clears hat linkage so a later save is a new Hat", () => {
    hydrateHatSavedProject(hatProject("Sue's Hiking Hat"));
    writeActiveCustomPatternProjectId("proj-hat-1", "Sue's Hiking Hat");
    expect(isEditingSavedHatProject()).toBe(true);

    const fresh = startOverHatBuilderSession({ unit: "inches", showTips: false });
    expect(fresh.patternProject).toBeUndefined();
    expect(readHatDraft()?.patternProject).toBeUndefined();
    expect(readHatActiveProjectId()).toBe("");
    expect(readHatActiveProjectLinkedName()).toBe("");
    expect(isEditingSavedHatProject()).toBe(false);
    expect(localStorage.getItem(HAT_ACTIVE_PROJECT_ID_KEY)).toBeNull();
    expect(localStorage.getItem(HAT_ACTIVE_PROJECT_NAME_KEY)).toBeNull();
    expect(readActiveCustomPatternProjectId()).toBe("");
    expect(resolveHatSavedPatternName(fresh)).toBe("");
    expect(resolveHatPatternPrintFields({ draft: fresh })).toEqual({
      title: "Hat Pattern",
      notes: "",
    });
    expect(resolveHatPatternOnlineHeading('Adult Woman — 20.5" finished', fresh)).not.toContain(
      "Sue's Hiking Hat",
    );
  });

  it("Start Over after a leftover sweater session keeps the sweater pointer and still isolates the Hat", () => {
    openSweaterNamedWalts();
    writeHatDraft(
      createEmptyHatDraft({
        sizeSel: "adult_woman",
        patternProject: { title: "Old Camp Hat", notes: "", titleCustomized: true },
      }),
    );

    const fresh = startOverHatBuilderSession({ unit: "cm", showTips: true });
    expect(fresh.unit).toBe("cm");
    expect(fresh.showTips).toBe(true);
    expect(fresh.patternProject).toBeUndefined();
    expect(isEditingSavedHatProject()).toBe(false);
    expect(resolveHatSavedPatternName(fresh)).toBe("");
    expect(readActiveCustomPatternProjectId()).toBe("proj-walt-sleeveless");
    expect(readActiveCustomPatternProjectLinkedName()).toBe("Walt's Men's Sleeveless");
    expect(resolveHatPatternPrintFields({ draft: fresh }).title).toBe("Hat Pattern");
  });

  it("New Pattern / ?new=1 also clears hat saved-project identity", () => {
    hydrateHatSavedProject(hatProject("Sue's Hiking Hat"));
    startFreshHatPattern();
    expect(readHatDraft()).toBeNull();
    expect(readHatActiveProjectId()).toBe("");
    expect(isEditingSavedHatProject()).toBe(false);
  });
});
