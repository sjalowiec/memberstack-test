import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  readActiveCustomPatternProjectLinkedName,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import {
  copySavedCustomPatternProjectById,
  formatPatternCopiedMessage,
  renameSavedCustomPatternProject,
} from "./savedCustomPatternManageActions";

vi.mock("./customPatternProjectClient", () => ({
  loadCustomPatternProject: vi.fn(),
  listCustomPatternProjects: vi.fn(async () => ({ ok: true, projects: [] })),
  createCustomPatternProject: vi.fn(),
  updateCustomPatternProject: vi.fn(),
  buildSavePayloadFromWorkingDraft: vi.fn(),
}));

// Copy is member-gated: stub an authorized member snapshot so the copy path runs.
// (Test-only — does not change production access logic.)
vi.mock("./sleevelessPatternSystemAccessClient", () => ({
  resolveSleevelessUserAccessSnapshot: vi.fn().mockResolvedValue({
    loggedIn: true,
    memberId: "ms_member",
    hasSystemAccess: true,
    freeClaimsBySystem: {},
  }),
}));

import {
  createCustomPatternProject,
  listCustomPatternProjects,
  loadCustomPatternProject,
  updateCustomPatternProject,
} from "./customPatternProjectClient";

const womensProject = {
  id: "proj-womens",
  name: "Women's Size 40 Pullover",
  family: "sleeveless" as const,
  source: "express" as const,
  notes: "keep ribbing",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  version: 3,
  customOverrides: { foo: 1 },
  pattern: {
    id: "pat-1",
    patternType: "sleeveless",
    style: { recipientCategory: "misses" },
    fit: { sizingChart: "misses", selectedSize: "40" },
    patternProject: { title: "Women's Size 40 Pullover", notes: "keep ribbing" },
  },
};

describe("copySavedCustomPatternProjectById", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(listCustomPatternProjects).mockResolvedValue({ ok: true, projects: [] });
  });

  it("copies a stored project into a new id, preserving the sizing chart, leaving the original unchanged", async () => {
    vi.mocked(loadCustomPatternProject).mockResolvedValue({ ok: true, project: womensProject });
    vi.mocked(listCustomPatternProjects).mockResolvedValue({
      ok: true,
      projects: [{ id: womensProject.id, name: womensProject.name }],
    });
    vi.mocked(createCustomPatternProject).mockImplementation(async (payload) => ({
      ok: true,
      project: { ...womensProject, id: "proj-copy", name: payload.name, pattern: payload.pattern },
    }));

    const res = await copySavedCustomPatternProjectById("proj-womens");

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.project.id).toBe("proj-copy");
    expect(res.project.id).not.toBe(womensProject.id);

    const payload = vi.mocked(createCustomPatternProject).mock.calls[0]?.[0];
    expect(payload?.name).toBe("Women's Size 40 Pullover - Copy");
    // Sizing chart + pattern data copied verbatim.
    expect(payload?.pattern).toBe(womensProject.pattern);
    expect(payload?.pattern.style).toMatchObject({ recipientCategory: "misses" });
    expect(payload?.pattern.fit).toMatchObject({ sizingChart: "misses", selectedSize: "40" });
    expect(payload?.source).toBe("express");

    // Copy never updates the original record.
    expect(updateCustomPatternProject).not.toHaveBeenCalled();
  });

  it("increments the copy name when a copy already exists", async () => {
    vi.mocked(loadCustomPatternProject).mockResolvedValue({ ok: true, project: womensProject });
    vi.mocked(listCustomPatternProjects).mockResolvedValue({
      ok: true,
      projects: [
        { id: womensProject.id, name: womensProject.name },
        { id: "c1", name: "Women's Size 40 Pullover - Copy" },
      ],
    });
    vi.mocked(createCustomPatternProject).mockImplementation(async (payload) => ({
      ok: true,
      project: { ...womensProject, id: "proj-copy-2", name: payload.name },
    }));

    await copySavedCustomPatternProjectById("proj-womens");

    expect(createCustomPatternProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Women's Size 40 Pullover - Copy 2" }),
    );
  });

  it("returns the load error without creating when the source cannot be loaded", async () => {
    vi.mocked(loadCustomPatternProject).mockResolvedValue({ ok: false, error: "not found" });

    const res = await copySavedCustomPatternProjectById("missing");

    expect(res).toEqual({ ok: false, error: "not found" });
    expect(createCustomPatternProject).not.toHaveBeenCalled();
  });

  it("formats the shared post-copy status message used by My Patterns surfaces", () => {
    expect(formatPatternCopiedMessage("Alpha pullover - Copy")).toBe(
      "Pattern copied. “Alpha pullover - Copy” is ready to edit.",
    );
    expect(formatPatternCopiedMessage("")).toBe(
      "Pattern copied. Your new copy is ready to edit.",
    );
  });
});

describe("renameSavedCustomPatternProject", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renames in place, keeping the same id and pattern data", async () => {
    vi.mocked(loadCustomPatternProject).mockResolvedValue({ ok: true, project: womensProject });
    vi.mocked(updateCustomPatternProject).mockImplementation(async (payload) => ({
      ok: true,
      project: { ...womensProject, name: payload.name },
    }));

    const res = await renameSavedCustomPatternProject("proj-womens", "Mom's Pullover");

    expect(res.ok).toBe(true);
    const payload = vi.mocked(updateCustomPatternProject).mock.calls[0]?.[0];
    expect(payload?.id).toBe("proj-womens");
    expect(payload?.name).toBe("Mom's Pullover");
    expect(payload?.pattern.patternProject?.title).toBe("Mom's Pullover");
    // Pattern body (sizing chart) is preserved.
    expect(payload?.pattern.style).toMatchObject({ recipientCategory: "misses" });
    expect(payload?.pattern.patternType).toBe("sleeveless");
    expect(payload?.metadataOnly).toBe(true);
    expect(createCustomPatternProject).not.toHaveBeenCalled();
  });

  it("does not write hat draft storage when renaming a sweater", async () => {
    localStorage.setItem(
      "kbm_hat_draft",
      JSON.stringify({ patternType: "hat", sizeSel: "adult_woman" }),
    );
    vi.mocked(loadCustomPatternProject).mockResolvedValue({ ok: true, project: womensProject });
    vi.mocked(updateCustomPatternProject).mockImplementation(async (payload) => ({
      ok: true,
      project: { ...womensProject, name: payload.name },
    }));

    await renameSavedCustomPatternProject("proj-womens", "Mom's Pullover");

    expect(localStorage.getItem("kbm_hat_draft")).toContain("adult_woman");
    const payload = vi.mocked(updateCustomPatternProject).mock.calls[0]?.[0];
    expect(payload?.pattern.patternType).toBe("sleeveless");
    expect((payload?.pattern as { brimType?: string }).brimType).toBeUndefined();
  });

  it("keeps the active linked name in sync when renaming the active project", async () => {
    writeActiveCustomPatternProjectId("proj-womens", "Women's Size 40 Pullover");
    vi.mocked(loadCustomPatternProject).mockResolvedValue({ ok: true, project: womensProject });
    vi.mocked(updateCustomPatternProject).mockImplementation(async (payload) => ({
      ok: true,
      project: { ...womensProject, name: payload.name },
    }));

    await renameSavedCustomPatternProject("proj-womens", "Mom's Pullover");

    expect(readActiveCustomPatternProjectLinkedName()).toBe("Mom's Pullover");
  });

  it("rejects an empty name without loading the project", async () => {
    const res = await renameSavedCustomPatternProject("proj-womens", "   ");
    expect(res).toEqual({ ok: false, error: "Enter a pattern name." });
    expect(loadCustomPatternProject).not.toHaveBeenCalled();
  });
});
