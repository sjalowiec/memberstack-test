import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "../test/stubLocalStorage";
import {
  readActiveCustomPatternProjectId,
  readActiveCustomPatternProjectLinkedName,
  writeActiveCustomPatternProjectId,
} from "../customPatternProjectActiveId";
import type { CustomPatternProject } from "../customPatternProjectTypes";
import { createEmptySockDraft, readSockDraft, writeSockDraft } from "./sockDraft";
import { startOverSockBuilderSession, startFreshSockPattern } from "./sockFreshStart";
import {
  applySockPatternNameToDraft,
  buildDefaultSockPatternTitle,
  hydrateSockSavedProject,
  isEditingSavedSockProject,
  isSockCustomPatternProject,
  readSockActiveProjectId,
  readSockActiveProjectLinkedName,
  resolveSockPatternDisplayName,
  resolveSockSavedPatternName,
  SOCK_ACTIVE_PROJECT_ID_KEY,
  SOCK_ACTIVE_PROJECT_NAME_KEY,
  SOCK_PATTERN_FAMILY_NAME,
  writeSockActiveProjectId,
} from "./sockSavedProject";
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

function sockProject(
  name: string,
  draftOverrides: Parameters<typeof createEmptySockDraft>[0] = {},
): CustomPatternProject {
  const draft = createEmptySockDraft({
    sizeSel: "woman_med",
    constructionDirection: "cuff-to-toe",
    footCircumference: "8.5",
    footLength: "9",
    legCircumference: "8.5",
    legLength: "4.5",
    patternProject: { title: name, notes: "", titleCustomized: true },
    ...draftOverrides,
  });
  return {
    id: "proj-sock-1",
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

describe("saved socks naming", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("uses the shared family-only default name (Socks), not an elaborate auto title", () => {
    expect(SOCK_PATTERN_FAMILY_NAME).toBe("Socks");
    expect(buildDefaultSockPatternTitle()).toBe("Socks");
    expect(createEmptySockDraft().patternProject?.title).toBe("Socks");
  });

  it("detects socks saved projects without treating sweaters or hats as socks", () => {
    expect(isSockCustomPatternProject(sockProject("Socks"))).toBe(true);
    expect(
      isSockCustomPatternProject({
        pattern: { patternType: "sleeveless", style: {} },
      }),
    ).toBe(false);
    expect(
      isSockCustomPatternProject({
        pattern: { patternType: "hat", patternSystem: "hat" },
      }),
    ).toBe(false);
  });

  it("hydrates a renamed socks pattern into kbm_socks_draft and the socks-only active project link", () => {
    saveCurrentPattern({ patternProject: { title: "Women's Sleeveless", notes: "" } });
    writeActiveCustomPatternProjectId("proj-sweater-1", "Women's Sleeveless");
    const project = sockProject("Aubrie's Hiking Socks");
    const draft = hydrateSockSavedProject(project);

    expect(draft.patternProject?.title).toBe("Aubrie's Hiking Socks");
    expect(draft.patternProject?.titleCustomized).toBe(true);
    expect(readSockDraft()?.patternProject?.title).toBe("Aubrie's Hiking Socks");
    expect(readSockActiveProjectId()).toBe("proj-sock-1");
    expect(readSockActiveProjectLinkedName()).toBe("Aubrie's Hiking Socks");
    expect(isEditingSavedSockProject()).toBe(true);
    expect(readActiveCustomPatternProjectLinkedName()).toBe("Women's Sleeveless");
    expect(getCurrentPattern().patternProject?.title).toBe("Women's Sleeveless");
  });

  it("replaces a leftover local Socks draft with the selected saved project", () => {
    writeSockDraft(
      createEmptySockDraft({
        sizeSel: "child",
        patternProject: { title: "Stale Local Socks", notes: "", titleCustomized: true },
      }),
    );
    writeSockActiveProjectId("proj-stale", "Stale Local Socks");
    const opened = hydrateSockSavedProject(
      sockProject("Camp Socks", {
        sizeSel: "woman_med",
        patternProject: { title: "Camp Socks", notes: "", titleCustomized: true },
      }),
    );
    expect(opened.patternProject?.title).toBe("Camp Socks");
    expect(readSockDraft()?.patternProject?.title).not.toBe("Stale Local Socks");
    expect(readSockActiveProjectId()).toBe("proj-sock-1");
  });
});

describe("renameSavedCustomPatternProject for socks", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renames a saved socks pattern in place using the same helper as sweaters", async () => {
    const project = sockProject("Socks");
    vi.mocked(loadCustomPatternProject).mockResolvedValue({ ok: true, project });
    vi.mocked(updateCustomPatternProject).mockImplementation(async (payload) => ({
      ok: true,
      project: { ...project, name: payload.name },
    }));

    const res = await renameSavedCustomPatternProject("proj-sock-1", "Aubrie's Hiking Socks");

    expect(res.ok).toBe(true);
    const payload = vi.mocked(updateCustomPatternProject).mock.calls[0]?.[0];
    expect(payload?.id).toBe("proj-sock-1");
    expect(payload?.name).toBe("Aubrie's Hiking Socks");
    expect(payload?.pattern.patternProject?.title).toBe("Aubrie's Hiking Socks");
    expect(payload?.pattern.patternProject?.titleCustomized).toBe(true);
    expect((payload?.pattern as { patternType?: string }).patternType).toBe("socks");
    expect((payload?.pattern as { sizeSel?: string }).sizeSel).toBe("woman_med");
  });
});

describe("applySockPatternNameToDraft", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("pins titleCustomized so the saved name is not treated as temporary", () => {
    const next = applySockPatternNameToDraft(createEmptySockDraft(), "  Camp Socks  ");
    expect(next.patternProject).toEqual({
      title: "Camp Socks",
      notes: "",
      titleCustomized: true,
    });
  });
});

describe("socks vs sweater saved-project isolation", () => {
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

  it("does not inherit a previously opened sweater id or title when entering the Socks flow", () => {
    openSweaterNamedWalts();
    writeSockDraft(createEmptySockDraft({ sizeSel: "woman_med" }));

    const draft = readSockDraft();
    expect(resolveSockSavedPatternName(draft)).toBe("Socks");
    expect(resolveSockPatternDisplayName(draft)).toBe("Socks");
    expect(isEditingSavedSockProject()).toBe(false);
    expect(readSockActiveProjectId()).toBe("");
    expect(resolveSockPatternDisplayName(draft)).not.toBe("Walt's Men's Sleeveless");
    expect(readActiveCustomPatternProjectLinkedName()).toBe("Walt's Men's Sleeveless");
    expect(getCurrentPattern().patternProject?.title).toBe("Walt's Men's Sleeveless");
  });

  it("Start Over from a saved Socks pattern clears socks linkage so a later save is a new pattern", () => {
    hydrateSockSavedProject(sockProject("Aubrie's Hiking Socks"));
    writeActiveCustomPatternProjectId("proj-sock-1", "Aubrie's Hiking Socks");
    expect(isEditingSavedSockProject()).toBe(true);

    const fresh = startOverSockBuilderSession({ unit: "inches" });
    expect(fresh.patternProject?.title).toBe("Socks");
    expect(fresh.patternProject?.titleCustomized).toBeUndefined();
    expect(readSockActiveProjectId()).toBe("");
    expect(readSockActiveProjectLinkedName()).toBe("");
    expect(isEditingSavedSockProject()).toBe(false);
    expect(localStorage.getItem(SOCK_ACTIVE_PROJECT_ID_KEY)).toBeNull();
    expect(localStorage.getItem(SOCK_ACTIVE_PROJECT_NAME_KEY)).toBeNull();
    expect(readActiveCustomPatternProjectId()).toBe("");
    expect(resolveSockPatternDisplayName(fresh)).toBe("Socks");
  });

  it("New Pattern / ?new=1 also clears socks saved-project identity", () => {
    hydrateSockSavedProject(sockProject("Aubrie's Hiking Socks"));
    startFreshSockPattern();
    expect(readSockDraft()).toBeNull();
    expect(readSockActiveProjectId()).toBe("");
    expect(isEditingSavedSockProject()).toBe(false);
  });
});

const summaryScript = readFileSync(resolve("src/scripts/socks-edit-page.ts"), "utf8");
const summaryWorkspace = readFileSync(
  resolve("src/components/patterns/SocksPatternEditWorkspace.astro"),
  "utf8",
);

describe("Socks Summary/Edit uses the shared name control", () => {
  it("places PatternProjectDetails on the shared Socks workspace", () => {
    expect(summaryWorkspace).toContain("PatternProjectDetails");
    expect(summaryWorkspace).toContain("data-socks-edit-title");
    expect(summaryScript).toContain("bindPatternProjectNotesField");
    expect(summaryScript).toContain("persistSockPatternProject");
  });
});
