import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stubLocalStorage } from "../test/stubLocalStorage";
import type { CustomPatternProject } from "../customPatternProjectTypes";
import { createEmptySockDraft, writeSockDraft } from "./sockDraft";
import { isEditingSavedSockProject, readSockActiveProjectId } from "./sockSavedProject";
import { persistSockPatternProject, sockDraftAsSavePattern } from "./sockPatternProjectSave";
import { resolvePatternSystemFromProject } from "../patternSystemId";
import { formatCustomPatternProjectType } from "../patternWorkspaceLibraryDrawer";

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

const editScript = readFileSync(resolve("src/scripts/socks-edit-page.ts"), "utf8");

function sockDraft(partial?: Parameters<typeof createEmptySockDraft>[0]) {
  return createEmptySockDraft({
    sizeSel: "woman_med",
    constructionDirection: "cuff-to-toe",
    footCircumference: "8.5",
    footLength: "9",
    legCircumference: "8.5",
    legLength: "4.5",
    gaugeSlots: {
      inches: { stitch: "28", row: "40" },
      cm: { stitch: "", row: "" },
    },
    availableNeedles: "200",
    ...partial,
  });
}

describe("Socks Update Pattern cloud persist", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(createCustomPatternProject).mockImplementation(async (payload) => {
      const project: CustomPatternProject = {
        id: "proj-sock-created",
        name: payload.name,
        family: payload.family ?? "sleeveless",
        source: payload.source ?? "express",
        notes: payload.notes ?? "",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        version: 1,
        customOverrides: payload.customOverrides ?? {},
        pattern: payload.pattern,
      };
      return { ok: true, project };
    });
    vi.mocked(updateCustomPatternProject).mockImplementation(async (payload) => {
      const project: CustomPatternProject = {
        id: payload.id,
        name: payload.name,
        family: payload.family ?? "sleeveless",
        source: payload.source ?? "express",
        notes: payload.notes ?? "",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
        version: (payload.version ?? 1) + 1,
        customOverrides: payload.customOverrides ?? {},
        pattern: payload.pattern,
      };
      return { ok: true, project };
    });
    vi.mocked(loadCustomPatternProject).mockImplementation(async (id) => ({
      ok: true,
      project: {
        id,
        name: "Socks",
        family: "sleeveless",
        source: "express",
        notes: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        version: 1,
        customOverrides: {},
        pattern: sockDraftAsSavePattern(sockDraft()),
      },
    }));
  });

  it("first Update Pattern creates a saved project; later Update Pattern updates that same project", async () => {
    writeSockDraft(sockDraft());
    expect(readSockActiveProjectId()).toBe("");
    expect(isEditingSavedSockProject()).toBe(false);

    const created = await persistSockPatternProject({
      draft: sockDraft(),
      name: "Socks",
      mode: "create",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(createCustomPatternProject).toHaveBeenCalledTimes(1);
    const createPayload = vi.mocked(createCustomPatternProject).mock.calls[0]?.[0];
    expect(createPayload?.family).toBe("sleeveless");
    expect(createPayload?.pattern.patternType).toBe("socks");
    expect((createPayload?.pattern as { patternSystem?: string }).patternSystem).toBe("socks");
    expect(createPayload?.pattern.patternProject?.title).toBe("Socks");
    expect(updateCustomPatternProject).not.toHaveBeenCalled();
    expect(readSockActiveProjectId()).toBe(created.project.id);
    expect(isEditingSavedSockProject()).toBe(true);

    const updated = await persistSockPatternProject({
      draft: sockDraft({ footLength: "10.5" }),
      name: created.project.name,
      mode: "update",
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;

    expect(createCustomPatternProject).toHaveBeenCalledTimes(1);
    expect(updateCustomPatternProject).toHaveBeenCalledTimes(1);
    expect(updated.project.id).toBe(created.project.id);
    expect(readSockActiveProjectId()).toBe(created.project.id);
    const pattern = updated.project.pattern as { footLength?: string };
    expect(pattern.footLength).toBe("10.5");
  });

  it("opening an existing saved Socks pattern updates and does not create", async () => {
    const created = await persistSockPatternProject({
      draft: sockDraft({
        patternProject: { title: "Camp Socks", notes: "", titleCustomized: true },
      }),
      name: "Camp Socks",
      mode: "create",
    });
    expect(created.ok).toBe(true);
    vi.mocked(createCustomPatternProject).mockClear();

    const updated = await persistSockPatternProject({
      draft: sockDraft({
        footLength: "10",
        patternProject: { title: "Camp Socks", notes: "", titleCustomized: true },
      }),
      name: "Camp Socks",
      mode: "update",
    });
    expect(updated.ok).toBe(true);
    expect(createCustomPatternProject).not.toHaveBeenCalled();
    expect(updateCustomPatternProject).toHaveBeenCalledTimes(1);
    expect(updated.ok && updated.project.name).toBe("Camp Socks");
  });

  it("classifies a saved socks blob as socks for Review Patterns", () => {
    const pattern = sockDraftAsSavePattern(
      sockDraft({ patternProject: { title: "Camp Socks", notes: "", titleCustomized: true } }),
    );
    expect(
      resolvePatternSystemFromProject({
        pattern,
        customOverrides: {},
      }),
    ).toBe("socks");
    expect(
      formatCustomPatternProjectType({
        id: "p-sock",
        name: "Camp Socks",
        family: "sleeveless",
        source: "express",
        patternSystem: "socks",
      }),
    ).toBe("Socks");
  });

  it("Update Pattern on Summary/Edit persists through persistSockPatternProject", () => {
    expect(editScript).toContain("persistSockPatternProject");
    expect(editScript).toContain("applySockPatternProjectDetailsToDraft");
    const updateStart = editScript.indexOf("async function persistAndNavigate");
    expect(updateStart).toBeGreaterThan(-1);
    const updateFn = editScript.slice(updateStart, updateStart + 1800);
    expect(updateFn).toContain("persistSockPatternProject");
    expect(updateFn).toContain("writeSockDraft(next)");
    expect(updateFn).toContain("SOCK_PATTERN_HREF");
  });
});
