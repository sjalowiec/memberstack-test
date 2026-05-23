import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  clearActiveCustomPatternProjectId,
  readActiveCustomPatternProjectId,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import { smartSaveCustomPatternProject } from "./customPatternSavedProjectsPanel";

vi.mock("./customPatternProjectClient", () => ({
  buildSavePayloadFromWorkingDraft: vi.fn((name: string) => ({
    name,
    notes: "",
    family: "sleeveless",
    source: "express",
    pattern: {},
    customOverrides: {},
  })),
  createCustomPatternProject: vi.fn(),
  updateCustomPatternProject: vi.fn(),
}));

import {
  buildSavePayloadFromWorkingDraft,
  createCustomPatternProject,
  updateCustomPatternProject,
} from "./customPatternProjectClient";

const existingProject = {
  id: "proj-justin",
  name: "Justin’s Green Vest",
  family: "sleeveless" as const,
  source: "express" as const,
  notes: "",
  pattern: {},
  customOverrides: {},
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const newProject = {
  id: "proj-walt",
  name: "Walt’s Green Vest",
  family: "sleeveless" as const,
  source: "express" as const,
  notes: "",
  pattern: {},
  customOverrides: {},
  createdAt: "2026-01-03T00:00:00.000Z",
  updatedAt: "2026-01-03T00:00:00.000Z",
};

describe("smartSaveCustomPatternProject", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("updates the same saved project when an active project id is set", async () => {
    writeActiveCustomPatternProjectId(existingProject.id);
    vi.mocked(updateCustomPatternProject).mockResolvedValue({
      ok: true,
      project: { ...existingProject, name: "Justin’s Green Vest" },
    });

    const res = await smartSaveCustomPatternProject({
      resolveName: () => "Justin’s Green Vest",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.created).toBe(false);
    expect(res.project.id).toBe("proj-justin");
    expect(updateCustomPatternProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: "proj-justin", name: "Justin’s Green Vest" }),
    );
    expect(createCustomPatternProject).not.toHaveBeenCalled();
    expect(readActiveCustomPatternProjectId()).toBe("proj-justin");
  });

  it("creates a new saved project when no active project id is set", async () => {
    clearActiveCustomPatternProjectId();
    vi.mocked(createCustomPatternProject).mockResolvedValue({
      ok: true,
      project: newProject,
    });

    const res = await smartSaveCustomPatternProject({
      resolveName: () => "Walt’s Green Vest",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.created).toBe(true);
    expect(res.project.id).toBe("proj-walt");
    expect(createCustomPatternProject).toHaveBeenCalled();
    expect(updateCustomPatternProject).not.toHaveBeenCalled();
    expect(readActiveCustomPatternProjectId()).toBe("proj-walt");
  });

  it("creates a new record after start-new cleared the previous active id", async () => {
    writeActiveCustomPatternProjectId(existingProject.id);
    clearActiveCustomPatternProjectId();
    expect(buildSavePayloadFromWorkingDraft).toBeDefined();

    vi.mocked(createCustomPatternProject).mockResolvedValue({
      ok: true,
      project: newProject,
    });

    const res = await smartSaveCustomPatternProject({
      resolveName: () => "Walt’s Green Vest",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.created).toBe(true);
    expect(createCustomPatternProject).toHaveBeenCalled();
    expect(updateCustomPatternProject).not.toHaveBeenCalled();
  });
});
