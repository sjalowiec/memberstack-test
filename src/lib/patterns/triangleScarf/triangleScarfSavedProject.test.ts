import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildProjectRecord } from "../../../../netlify/functions/lib/custom-pattern-projects-store.js";
import { resolveAccountMyPatternsSystem, shouldOfferSavedPatternRename } from "../accountMyPatternsList";
import type { CustomPatternProject } from "../customPatternProjectTypes";
import {
  getContinueEditingHref,
  getOpenPatternHrefForProject,
  getSavedCustomPatternOpenHref,
} from "../customPatternProjectNavigation";
import { patternSystemDisplayName, resolvePatternSystemFromProject } from "../patternSystemId";
import { extractSavedProjectGauge, formatSavedPatternGauge } from "../savedPatternGaugeDisplay";
import { resolveSavedPatternMemberNotesTarget } from "../savedPatternMemberNotes";
import { stubLocalStorage } from "../test/stubLocalStorage";
import {
  formatCustomPatternProjectType,
} from "../patternWorkspaceLibraryDrawer";
import { createTriangleScarfDraft, readTriangleScarfDraft } from "./triangleScarfDraft";
import {
  TRIANGLE_SCARF_ACTIVE_PROJECT_ID_KEY,
  TRIANGLE_SCARF_PATTERN_FAMILY_NAME,
  hydrateTriangleScarfSavedProject,
  isEditingSavedTriangleScarfProject,
  readTriangleScarfActiveProjectId,
  resolveTriangleScarfPatternProjectNotes,
  startFreshTriangleScarfPattern,
  writeTriangleScarfActiveProjectId,
} from "./triangleScarfSavedProject";
import {
  persistTriangleScarfPatternProject,
  resolveTriangleScarfPatternPersistAction,
  triangleScarfDraftAsSavePattern,
} from "./triangleScarfPatternProjectSave";

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

const freshStartSource = readFileSync(
  resolve("src/lib/patterns/triangleScarf/triangleScarfSavedProject.ts"),
  "utf8",
);

function scarfDraft(name = "Weekend Triangle Scarf", notes = "Blue yarn") {
  return createTriangleScarfDraft({
    length: "36",
    depth: "18",
    stitchGauge: "28",
    rowGauge: "40",
    needles: "200",
    unit: "in",
    patternProject: { title: name, notes, titleCustomized: true },
  });
}

function scarfProject(name = "Camp Scarf", notes = "Hold the edge"): CustomPatternProject {
  return {
    id: "proj-scarf-1",
    name,
    family: "sleeveless",
    source: "express",
    notes,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-02T00:00:00.000Z",
    version: 3,
    customOverrides: {},
    pattern: scarfDraft(name, notes) as unknown as CustomPatternProject["pattern"],
  };
}

describe("Weekend Triangle Scarf saved projects", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("labels My Patterns as Weekend Triangle Scarf and opens the scarf pages", () => {
    const project = scarfProject();
    expect(TRIANGLE_SCARF_PATTERN_FAMILY_NAME).toBe("Weekend Triangle Scarf");
    expect(patternSystemDisplayName("triangle-scarf")).toBe("Weekend Triangle Scarf");
    expect(resolvePatternSystemFromProject(project)).toBe("triangle-scarf");
    expect(resolveAccountMyPatternsSystem({ patternSystem: "triangle-scarf" })).toBe("triangle-scarf");
    expect(formatCustomPatternProjectType({
      id: project.id,
      name: project.name,
      family: "sleeveless",
      source: "express",
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      version: project.version,
      patternSystem: "triangle-scarf",
    })).toBe("Weekend Triangle Scarf");
    expect(shouldOfferSavedPatternRename("triangle-scarf")).toBe(true);
    expect(getOpenPatternHrefForProject(project)).toBe("/patterns/triangle-scarf/pattern/");
    expect(getSavedCustomPatternOpenHref("express", project)).toBe(
      "/patterns/triangle-scarf/summary/?edit=1&project=proj-scarf-1",
    );
    expect(getContinueEditingHref("express", project)).toBe(
      "/patterns/triangle-scarf/summary/?edit=1&project=proj-scarf-1",
    );
    expect(getOpenPatternHrefForProject(project)).not.toContain("/patterns/hat/");
    expect(getSavedCustomPatternOpenHref("express", project)).not.toContain("/patterns/sleeveless/");
  });

  it("saves, reopens, and updates project notes without creating a second project", async () => {
    vi.mocked(createCustomPatternProject).mockResolvedValue({
      ok: true,
      project: scarfProject("Weekend Triangle Scarf", "Blue yarn"),
    });
    const created = await persistTriangleScarfPatternProject({
      draft: scarfDraft(),
      name: "Weekend Triangle Scarf",
      mode: "create",
    });
    expect(created.ok).toBe(true);
    expect(vi.mocked(updateCustomPatternProject)).not.toHaveBeenCalled();
    const createPayload = vi.mocked(createCustomPatternProject).mock.calls[0]?.[0];
    expect(createPayload?.pattern.patternType).toBe("triangle-scarf");
    expect(createPayload?.notes).toBe("Blue yarn");
    expect(resolvePatternSystemFromProject({
      pattern: createPayload!.pattern,
      customOverrides: createPayload!.customOverrides ?? {},
    })).toBe("triangle-scarf");

    localStorage.clear();
    const opened = hydrateTriangleScarfSavedProject(scarfProject("Camp Scarf", "Hold the edge"));
    expect(opened.patternProject?.title).toBe("Camp Scarf");
    expect(resolveTriangleScarfPatternProjectNotes(opened)).toBe("Hold the edge");
    expect(readTriangleScarfActiveProjectId()).toBe("proj-scarf-1");
    expect(readTriangleScarfDraft()?.length).toBe("36");

    vi.mocked(loadCustomPatternProject).mockResolvedValue({ ok: true, project: scarfProject() });
    vi.mocked(updateCustomPatternProject).mockResolvedValue({
      ok: true,
      project: { ...scarfProject("Camp Scarf", "New note"), version: 4 },
    });
    const updated = await persistTriangleScarfPatternProject({
      draft: { ...opened, depth: "20", patternProject: { title: "Camp Scarf", notes: "New note", titleCustomized: true } },
      name: "Camp Scarf",
      mode: "update",
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) expect(updated.created).toBe(false);
    expect(vi.mocked(createCustomPatternProject)).toHaveBeenCalledTimes(1);
    const updatePayload = vi.mocked(updateCustomPatternProject).mock.calls[0]?.[0];
    expect(updatePayload?.id).toBe("proj-scarf-1");
    expect(updatePayload?.notes).toBe("New note");
    expect(updatePayload?.pattern.patternType).toBe("triangle-scarf");
  });

  it("copies as a Weekend Triangle Scarf and keeps the original id out of the new payload", () => {
    const pattern = triangleScarfDraftAsSavePattern(scarfDraft("Aunt Mae", "Soft wool"));
    const copyPayload = {
      name: "Aunt Mae - Copy",
      notes: "Soft wool",
      family: "sleeveless" as const,
      source: "express" as const,
      pattern,
      customOverrides: {},
    };
    expect(resolvePatternSystemFromProject(copyPayload)).toBe("triangle-scarf");
    const built = buildProjectRecord(copyPayload, "member-1");
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.project.pattern.patternType).toBe("triangle-scarf");
    expect(built.project.pattern.patternSystem).toBe("triangle-scarf");
    expect(built.project.name).toBe("Aunt Mae - Copy");
    expect(built.project.notes).toBe("Soft wool");
    expect(built.project.id).not.toBe("proj-scarf-1");
    expect(formatSavedPatternGauge(extractSavedProjectGauge({
      patternSystem: "triangle-scarf",
      pattern,
    }))).toBe("28 sts / 40 rows");
  });

  it("starts a new scarf by dropping the local link and leaving the saved project in place", () => {
    hydrateTriangleScarfSavedProject(scarfProject());
    expect(isEditingSavedTriangleScarfProject()).toBe(true);
    localStorage.setItem("kbm_saved_project_should_remain", "proj-scarf-1");
    startFreshTriangleScarfPattern();
    expect(readTriangleScarfActiveProjectId()).toBe("");
    expect(localStorage.getItem(TRIANGLE_SCARF_ACTIVE_PROJECT_ID_KEY)).toBeNull();
    expect(readTriangleScarfDraft()).toBeNull();
    expect(localStorage.getItem("kbm_saved_project_should_remain")).toBe("proj-scarf-1");
    expect(freshStartSource).not.toContain("deleteCustomPatternProject");
    expect(freshStartSource).not.toContain("deleteSavedCustomPatternProject");
    expect(
      resolveTriangleScarfPatternPersistAction({
        hasMemberSavedProjectPrivileges: true,
        activeProjectId: "",
        entryPath: "from-finished-pattern",
      }).persist,
    ).toBe("create");
  });

  it("uses the scarf project id for My Notes and does not borrow a sweater id", () => {
    writeTriangleScarfActiveProjectId("proj-scarf-1", "Camp Scarf");
    expect(
      resolveSavedPatternMemberNotesTarget("/patterns/triangle-scarf/pattern/", {
        hat: "hat-1",
        triangleScarf: "proj-scarf-1",
        socks: "",
        stocking: "",
        sweater: "sweater-1",
      }),
    ).toEqual({ projectId: "proj-scarf-1", family: "sleeveless" });
    expect(
      resolveSavedPatternMemberNotesTarget("/patterns/triangle-scarf/builder", {
        hat: "",
        triangleScarf: "proj-scarf-1",
        socks: "",
        stocking: "",
        sweater: "sweater-1",
      }),
    ).toBeNull();
  });
});
