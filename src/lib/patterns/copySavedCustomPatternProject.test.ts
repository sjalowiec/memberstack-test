import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  copySavedCustomPatternProject,
  resolveUniqueCopyName,
} from "./copySavedCustomPatternProject";

const loadCustomPatternProjectMock = vi.fn();
const createCustomPatternProjectMock = vi.fn();
const listCustomPatternProjectsMock = vi.fn();
const hydrateMock = vi.fn();

vi.mock("./customPatternProjectClient", () => ({
  loadCustomPatternProject: (...args: unknown[]) => loadCustomPatternProjectMock(...args),
  createCustomPatternProject: (...args: unknown[]) => createCustomPatternProjectMock(...args),
  listCustomPatternProjects: (...args: unknown[]) => listCustomPatternProjectsMock(...args),
}));

vi.mock("./hydrateSavedCustomPatternProject", () => ({
  hydrateSavedCustomPatternProjectSession: (...args: unknown[]) => hydrateMock(...args),
}));

function makeOriginalProject() {
  return {
    id: "proj-original",
    name: "My Sweater",
    notes: "Original notes",
    family: "sleeveless" as const,
    source: "express" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    version: 3,
    pattern: {
      id: "pat-1",
      patternType: "sleeveless" as const,
      status: "draft" as const,
      version: 3,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      style: { recipientCategory: "misses", garmentStyle: "pullover" },
      fit: { sizingChart: "misses", selectedSize: "40" },
      yarnGauge: {},
      measurements: {},
      machine: {},
      calculations: { stitches: 120 },
      instructions: { rows: 200 },
      patternProject: { title: "My Sweater", notes: "Original notes" },
    },
    customOverrides: { neckDepth: 5 },
  };
}

describe("resolveUniqueCopyName", () => {
  it("uses '[Name] - Copy' when no copy exists yet", () => {
    expect(resolveUniqueCopyName("My Sweater", ["My Sweater"])).toBe("My Sweater - Copy");
  });

  it("increments to '- Copy 2', '- Copy 3' as duplicates accumulate", () => {
    const names = ["My Sweater"];
    const first = resolveUniqueCopyName("My Sweater", names);
    expect(first).toBe("My Sweater - Copy");

    names.push(first);
    const second = resolveUniqueCopyName("My Sweater", names);
    expect(second).toBe("My Sweater - Copy 2");

    names.push(second);
    const third = resolveUniqueCopyName("My Sweater", names);
    expect(third).toBe("My Sweater - Copy 3");
  });

  it("dedupes case-insensitively", () => {
    expect(resolveUniqueCopyName("My Sweater", ["my sweater - copy"])).toBe("My Sweater - Copy 2");
  });

  it("falls back to 'Untitled pattern' for an empty name", () => {
    expect(resolveUniqueCopyName("   ", [])).toBe("Untitled pattern - Copy");
  });
});

describe("copySavedCustomPatternProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("copies a saved project into a new project id without touching the original", async () => {
    const original = makeOriginalProject();
    const originalSnapshot = JSON.parse(JSON.stringify(original));
    loadCustomPatternProjectMock.mockResolvedValue({ ok: true, project: original });
    createCustomPatternProjectMock.mockImplementation(async (payload) => ({
      ok: true,
      project: { ...payload, id: "proj-copy-1", createdAt: "x", updatedAt: "x", version: 1 },
    }));

    const result = await copySavedCustomPatternProject("proj-original", {
      existingNames: ["My Sweater"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.id).toBe("proj-copy-1");
    expect(result.project.id).not.toBe(original.id);
    // Original record was only loaded, never updated, and was not mutated.
    expect(original).toEqual(originalSnapshot);
    expect(createCustomPatternProjectMock).toHaveBeenCalledTimes(1);
  });

  it("preserves the original sizing chart exactly on the copy", async () => {
    const original = makeOriginalProject();
    loadCustomPatternProjectMock.mockResolvedValue({ ok: true, project: original });
    createCustomPatternProjectMock.mockImplementation(async (payload) => ({
      ok: true,
      project: { ...payload, id: "proj-copy-1" },
    }));

    await copySavedCustomPatternProject("proj-original", { existingNames: ["My Sweater"] });

    const payload = createCustomPatternProjectMock.mock.calls[0][0];
    expect(payload.pattern.fit.sizingChart).toBe("misses");
    expect(payload.pattern.style.recipientCategory).toBe("misses");
    // Generated pattern data + settings carried over verbatim.
    expect(payload.pattern.calculations).toEqual({ stitches: 120 });
    expect(payload.pattern.instructions).toEqual({ rows: 200 });
    expect(payload.customOverrides).toEqual({ neckDepth: 5 });
  });

  it("names the copy '[Original Name] - Copy'", async () => {
    const original = makeOriginalProject();
    loadCustomPatternProjectMock.mockResolvedValue({ ok: true, project: original });
    createCustomPatternProjectMock.mockImplementation(async (payload) => ({
      ok: true,
      project: { ...payload, id: "proj-copy-1" },
    }));

    await copySavedCustomPatternProject("proj-original", { existingNames: ["My Sweater"] });

    const payload = createCustomPatternProjectMock.mock.calls[0][0];
    expect(payload.name).toBe("My Sweater - Copy");
    expect(payload.pattern.patternProject.title).toBe("My Sweater - Copy");
  });

  it("opens the copy as the active project", async () => {
    const original = makeOriginalProject();
    loadCustomPatternProjectMock.mockResolvedValue({ ok: true, project: original });
    const createdProject = {
      ...makeOriginalProject(),
      id: "proj-copy-1",
      name: "My Sweater - Copy",
    };
    createCustomPatternProjectMock.mockResolvedValue({ ok: true, project: createdProject });

    const result = await copySavedCustomPatternProject("proj-original", {
      existingNames: ["My Sweater"],
    });

    expect(result.ok).toBe(true);
    expect(hydrateMock).toHaveBeenCalledTimes(1);
    expect(hydrateMock).toHaveBeenCalledWith(createdProject);
  });

  it("fetches existing names from the list when not provided", async () => {
    const original = makeOriginalProject();
    loadCustomPatternProjectMock.mockResolvedValue({ ok: true, project: original });
    listCustomPatternProjectsMock.mockResolvedValue({
      ok: true,
      projects: [{ name: "My Sweater" }, { name: "My Sweater - Copy" }],
    });
    createCustomPatternProjectMock.mockImplementation(async (payload) => ({
      ok: true,
      project: { ...payload, id: "proj-copy-2" },
    }));

    await copySavedCustomPatternProject("proj-original");

    expect(listCustomPatternProjectsMock).toHaveBeenCalledWith("sleeveless");
    expect(createCustomPatternProjectMock.mock.calls[0][0].name).toBe("My Sweater - Copy 2");
  });

  it("returns the load error and does not create when loading fails", async () => {
    loadCustomPatternProjectMock.mockResolvedValue({ ok: false, error: "not found" });

    const result = await copySavedCustomPatternProject("missing");

    expect(result).toEqual({ ok: false, error: "not found" });
    expect(createCustomPatternProjectMock).not.toHaveBeenCalled();
    expect(hydrateMock).not.toHaveBeenCalled();
  });
});
