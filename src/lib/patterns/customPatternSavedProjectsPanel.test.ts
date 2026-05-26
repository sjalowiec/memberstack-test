import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  clearActiveCustomPatternProjectId,
  readActiveCustomPatternProjectId,
  readActiveCustomPatternProjectLinkedName,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import {
  resolveSaveCopyProjectName,
  smartSaveCustomPatternProject,
} from "./customPatternSavedProjectsPanel";

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

const womensPullover = {
  id: "proj-womens-pullover",
  name: "Women's Size 40 Pullover",
  family: "sleeveless" as const,
  source: "express" as const,
  notes: "",
  pattern: { style: { recipientCategory: "misses", garmentStyle: "pullover" } },
  customOverrides: {},
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const kidsCardigan = {
  id: "proj-kids-cardigan",
  name: "Child's Size 8 Cardigan",
  family: "sleeveless" as const,
  source: "express" as const,
  notes: "",
  pattern: { style: { recipientCategory: "kids", garmentStyle: "cardigan" } },
  customOverrides: {},
  createdAt: "2026-01-03T00:00:00.000Z",
  updatedAt: "2026-01-03T00:00:00.000Z",
};

describe("resolveSaveCopyProjectName", () => {
  it("appends Copy when the title matches the linked saved name", () => {
    expect(resolveSaveCopyProjectName("Mom's vest", "Mom's vest")).toBe("Mom's vest Copy");
  });

  it("keeps a user-renamed title unchanged", () => {
    expect(resolveSaveCopyProjectName("Walt's Green Vest", "Mom's vest")).toBe("Walt's Green Vest");
  });
});

describe("smartSaveCustomPatternProject", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("creates the first saved pattern as a new record", async () => {
    vi.mocked(createCustomPatternProject).mockResolvedValue({
      ok: true,
      project: womensPullover,
    });

    const res = await smartSaveCustomPatternProject({
      mode: "create",
      resolveName: () => womensPullover.name,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.created).toBe(true);
    expect(res.project.id).toBe("proj-womens-pullover");
    expect(createCustomPatternProject).toHaveBeenCalledTimes(1);
    expect(updateCustomPatternProject).not.toHaveBeenCalled();
    expect(readActiveCustomPatternProjectId()).toBe("proj-womens-pullover");
    expect(readActiveCustomPatternProjectLinkedName()).toBe(womensPullover.name);
  });

  it("creates a second saved pattern instead of overwriting the first", async () => {
    writeActiveCustomPatternProjectId(womensPullover.id, womensPullover.name);
    vi.mocked(createCustomPatternProject).mockResolvedValue({
      ok: true,
      project: kidsCardigan,
    });

    const res = await smartSaveCustomPatternProject({
      mode: "create",
      resolveName: () => kidsCardigan.name,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.created).toBe(true);
    expect(res.project.id).toBe("proj-kids-cardigan");
    expect(createCustomPatternProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: kidsCardigan.name }),
    );
    expect(updateCustomPatternProject).not.toHaveBeenCalled();
    expect(readActiveCustomPatternProjectId()).toBe("proj-kids-cardigan");
  });

  it("does not update an existing saved project when mode is create even with an active id", async () => {
    writeActiveCustomPatternProjectId(womensPullover.id, womensPullover.name);
    vi.mocked(createCustomPatternProject).mockResolvedValue({
      ok: true,
      project: kidsCardigan,
    });

    await smartSaveCustomPatternProject({
      mode: "create",
      resolveName: () => kidsCardigan.name,
    });

    expect(updateCustomPatternProject).not.toHaveBeenCalled();
    expect(createCustomPatternProject).toHaveBeenCalled();
  });

  it("save copy creates a new record with a Copy suffix when the title was not renamed", async () => {
    writeActiveCustomPatternProjectId(womensPullover.id, womensPullover.name);
    vi.mocked(createCustomPatternProject).mockResolvedValue({
      ok: true,
      project: {
        ...womensPullover,
        id: "proj-womens-copy",
        name: "Women's Size 40 Pullover Copy",
      },
    });

    const res = await smartSaveCustomPatternProject({
      mode: "copy",
      resolveName: () => womensPullover.name,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.created).toBe(true);
    expect(createCustomPatternProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Women's Size 40 Pullover Copy" }),
    );
    expect(updateCustomPatternProject).not.toHaveBeenCalled();
    expect(readActiveCustomPatternProjectId()).toBe("proj-womens-copy");
  });

  it("save copy keeps a renamed title and still creates a new record", async () => {
    writeActiveCustomPatternProjectId(womensPullover.id, womensPullover.name);
    vi.mocked(createCustomPatternProject).mockResolvedValue({
      ok: true,
      project: kidsCardigan,
    });

    const res = await smartSaveCustomPatternProject({
      mode: "copy",
      resolveName: () => kidsCardigan.name,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(createCustomPatternProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: kidsCardigan.name }),
    );
    expect(updateCustomPatternProject).not.toHaveBeenCalled();
  });

  it("update mode preserves the same saved project id", async () => {
    writeActiveCustomPatternProjectId(womensPullover.id, womensPullover.name);
    vi.mocked(updateCustomPatternProject).mockResolvedValue({
      ok: true,
      project: { ...womensPullover, name: "Women's Size 40 Pullover (revised)" },
    });

    const res = await smartSaveCustomPatternProject({
      mode: "update",
      resolveName: () => "Women's Size 40 Pullover (revised)",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.created).toBe(false);
    expect(res.project.id).toBe("proj-womens-pullover");
    expect(updateCustomPatternProject).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "proj-womens-pullover",
        name: "Women's Size 40 Pullover (revised)",
      }),
    );
    expect(createCustomPatternProject).not.toHaveBeenCalled();
    expect(readActiveCustomPatternProjectId()).toBe("proj-womens-pullover");
  });

  it("creates a new record after start-new cleared the previous active id", async () => {
    writeActiveCustomPatternProjectId(womensPullover.id, womensPullover.name);
    clearActiveCustomPatternProjectId();
    expect(buildSavePayloadFromWorkingDraft).toBeDefined();

    vi.mocked(createCustomPatternProject).mockResolvedValue({
      ok: true,
      project: kidsCardigan,
    });

    const res = await smartSaveCustomPatternProject({
      mode: "create",
      resolveName: () => kidsCardigan.name,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.created).toBe(true);
    expect(createCustomPatternProject).toHaveBeenCalled();
    expect(updateCustomPatternProject).not.toHaveBeenCalled();
  });
});
