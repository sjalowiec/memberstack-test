import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  clearActiveCustomPatternProjectId,
  readActiveCustomPatternProjectId,
  readActiveCustomPatternProjectLinkedName,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import {
  buildCopyBaseName,
  nameMatchesDefaultOrNumbered,
  resolveDefaultCustomPatternSaveMode,
  resolveUniqueCopyName,
  resolveUniqueDefaultPatternName,
  smartSaveCustomPatternProject,
  stripCustomPatternCopySuffix,
} from "./customPatternSavedProjectsPanel";
import { getPatternProjectMeta, savePatternProjectMeta } from "./sleevelessPatternProjectMeta";
import { saveCurrentPattern } from "./patternStorage";

vi.mock("./customPatternProjectClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./customPatternProjectClient")>();
  return {
    ...actual,
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
    listCustomPatternProjects: vi.fn(async () => ({ ok: true, projects: [] })),
  };
});

import {
  buildSavePayloadFromWorkingDraft,
  createCustomPatternProject,
  listCustomPatternProjects,
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

describe("stripCustomPatternCopySuffix", () => {
  it("leaves a name with no copy suffix unchanged", () => {
    expect(stripCustomPatternCopySuffix("test woman size 2")).toBe("test woman size 2");
  });

  it("strips ' - Copy' and numbered ' - Copy N' suffixes", () => {
    expect(stripCustomPatternCopySuffix("test woman size 2 - Copy")).toBe("test woman size 2");
    expect(stripCustomPatternCopySuffix("test woman size 2 - Copy 2")).toBe("test woman size 2");
    expect(stripCustomPatternCopySuffix("test woman size 2 - Copy 10")).toBe("test woman size 2");
  });

  it("strips legacy stacked suffixes back to the base name", () => {
    expect(stripCustomPatternCopySuffix("test woman size 2 - Copy - Copy")).toBe(
      "test woman size 2",
    );
    expect(stripCustomPatternCopySuffix("test woman size 2 - Copy - Copy - Copy")).toBe(
      "test woman size 2",
    );
  });

  it("is case-insensitive and does not touch 'Copy' inside the base name", () => {
    expect(stripCustomPatternCopySuffix("Copycat sweater")).toBe("Copycat sweater");
    expect(stripCustomPatternCopySuffix("Copycat sweater - copy 3")).toBe("Copycat sweater");
  });
});

describe("buildCopyBaseName", () => {
  it("appends ' - Copy' to the original name", () => {
    expect(buildCopyBaseName("My Sweater")).toBe("My Sweater - Copy");
  });

  it("trims and returns empty for blank names", () => {
    expect(buildCopyBaseName("  Mom's vest  ")).toBe("Mom's vest - Copy");
    expect(buildCopyBaseName("   ")).toBe("");
  });

  it("never stacks ' - Copy' onto an already-copied name", () => {
    expect(buildCopyBaseName("My Sweater - Copy")).toBe("My Sweater - Copy");
    expect(buildCopyBaseName("My Sweater - Copy 2")).toBe("My Sweater - Copy");
  });
});

describe("resolveUniqueCopyName", () => {
  it("copying the original creates 'Name - Copy'", () => {
    expect(resolveUniqueCopyName("test woman size 2", ["test woman size 2"])).toBe(
      "test woman size 2 - Copy",
    );
  });

  it("copying 'Name - Copy' creates 'Name - Copy 2'", () => {
    expect(
      resolveUniqueCopyName("test woman size 2 - Copy", [
        "test woman size 2",
        "test woman size 2 - Copy",
      ]),
    ).toBe("test woman size 2 - Copy 2");
  });

  it("copying 'Name - Copy 2' creates 'Name - Copy 3'", () => {
    expect(
      resolveUniqueCopyName("test woman size 2 - Copy 2", [
        "test woman size 2",
        "test woman size 2 - Copy",
        "test woman size 2 - Copy 2",
      ]),
    ).toBe("test woman size 2 - Copy 3");
  });

  it("uses ' - Copy' when no collision exists", () => {
    expect(resolveUniqueCopyName("My Sweater", ["My Sweater"])).toBe("My Sweater - Copy");
  });

  it("increments duplicate copy names: Copy, Copy 2, Copy 3", () => {
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

  it("fills the lowest available number when copies already exist", () => {
    // Source is the original; "- Copy" and "- Copy 2" already taken -> next is "- Copy 3".
    expect(
      resolveUniqueCopyName("test woman size 2", [
        "test woman size 2",
        "test woman size 2 - Copy",
        "test woman size 2 - Copy 2",
      ]),
    ).toBe("test woman size 2 - Copy 3");
  });

  it("matches existing names case-insensitively", () => {
    expect(resolveUniqueCopyName("My Sweater", ["my sweater - copy"])).toBe("My Sweater - Copy 2");
  });

  it("never produces 'Copy - Copy' when copying an already-copied pattern", () => {
    const result = resolveUniqueCopyName("test woman size 2 - Copy", [
      "test woman size 2 - Copy",
    ]);
    expect(result).toBe("test woman size 2 - Copy 2");
    expect(result).not.toContain("Copy - Copy");
  });
});

describe("resolveUniqueDefaultPatternName", () => {
  it("returns the base name when nothing matches", () => {
    expect(resolveUniqueDefaultPatternName("Women's Drop Shoulder", [])).toBe(
      "Women's Drop Shoulder",
    );
    expect(resolveUniqueDefaultPatternName("Women's Drop Shoulder", ["Men's Drop Shoulder"])).toBe(
      "Women's Drop Shoulder",
    );
  });

  it("appends ' 2' when the base default already exists", () => {
    expect(
      resolveUniqueDefaultPatternName("Women's Drop Shoulder", ["Women's Drop Shoulder"]),
    ).toBe("Women's Drop Shoulder 2");
  });

  it("uses the next available number", () => {
    expect(
      resolveUniqueDefaultPatternName("Women's Drop Shoulder", [
        "Women's Drop Shoulder",
        "Women's Drop Shoulder 2",
      ]),
    ).toBe("Women's Drop Shoulder 3");
  });

  it("matches existing names case-insensitively", () => {
    expect(resolveUniqueDefaultPatternName("Women's Sleeveless", ["women's sleeveless"])).toBe(
      "Women's Sleeveless 2",
    );
  });

  it("returns empty for a blank base name", () => {
    expect(resolveUniqueDefaultPatternName("   ", ["Women's Sleeveless"])).toBe("");
  });
});

describe("nameMatchesDefaultOrNumbered", () => {
  it("matches the exact default title (case-insensitive)", () => {
    expect(nameMatchesDefaultOrNumbered("Women's Sleeveless", "Women's Sleeveless")).toBe(true);
    expect(nameMatchesDefaultOrNumbered("women's sleeveless", "Women's Sleeveless")).toBe(true);
  });

  it("matches numbered variants of the default", () => {
    expect(nameMatchesDefaultOrNumbered("Women's Sleeveless 2", "Women's Sleeveless")).toBe(true);
    expect(nameMatchesDefaultOrNumbered("Women's Sleeveless 37", "Women's Sleeveless")).toBe(true);
  });

  it("does not match custom names or partial words", () => {
    expect(nameMatchesDefaultOrNumbered("Mom's birthday vest", "Women's Sleeveless")).toBe(false);
    expect(nameMatchesDefaultOrNumbered("Women's Sleeveless Deluxe", "Women's Sleeveless")).toBe(
      false,
    );
    expect(nameMatchesDefaultOrNumbered("Women's Sleevelessness", "Women's Sleeveless")).toBe(false);
  });

  it("returns false for blank inputs", () => {
    expect(nameMatchesDefaultOrNumbered("", "Women's Sleeveless")).toBe(false);
    expect(nameMatchesDefaultOrNumbered("Women's Sleeveless", "")).toBe(false);
  });
});

describe("smartSaveCustomPatternProject", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(listCustomPatternProjects).mockResolvedValue({ ok: true, projects: [] });
  });

  it("ordinary save without mode updates the linked project on a later save", async () => {
    vi.mocked(createCustomPatternProject).mockResolvedValue({
      ok: true,
      project: womensPullover,
    });
    vi.mocked(updateCustomPatternProject).mockResolvedValue({
      ok: true,
      project: { ...womensPullover, name: "Women's Size 40 Pullover (revised)" },
    });

    const first = await smartSaveCustomPatternProject({
      resolveName: () => womensPullover.name,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.created).toBe(true);
    expect(createCustomPatternProject).toHaveBeenCalledTimes(1);
    expect(updateCustomPatternProject).not.toHaveBeenCalled();

    const second = await smartSaveCustomPatternProject({
      resolveName: () => "Women's Size 40 Pullover (revised)",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.created).toBe(false);
    expect(second.project.id).toBe("proj-womens-pullover");
    expect(createCustomPatternProject).toHaveBeenCalledTimes(1);
    expect(updateCustomPatternProject).toHaveBeenCalledTimes(1);
    expect(readActiveCustomPatternProjectId()).toBe("proj-womens-pullover");
  });

  it("resolveDefaultCustomPatternSaveMode returns update when a project is linked", () => {
    writeActiveCustomPatternProjectId(womensPullover.id, womensPullover.name);
    expect(resolveDefaultCustomPatternSaveMode()).toBe("update");
    clearActiveCustomPatternProjectId();
    expect(resolveDefaultCustomPatternSaveMode()).toBe("create");
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

  it("appends a number to the default name on create when it already exists", async () => {
    // Draft carries the auto-generated default name (not manually renamed).
    savePatternProjectMeta({ title: "Women's Drop Shoulder", titleCustomized: false });
    vi.mocked(listCustomPatternProjects).mockResolvedValue({
      ok: true,
      projects: [{ id: "p1", name: "Women's Drop Shoulder" } as never],
    });
    vi.mocked(createCustomPatternProject).mockResolvedValue({
      ok: true,
      project: { ...womensPullover, id: "p2", name: "Women's Drop Shoulder 2" },
    });

    const res = await smartSaveCustomPatternProject({
      mode: "create",
      resolveName: () => "Women's Drop Shoulder",
    });

    expect(res.ok).toBe(true);
    expect(createCustomPatternProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Women's Drop Shoulder 2" }),
    );
  });

  it("increments an auto default even after the title was pinned as customized (review-page Save bug)", async () => {
    // Reproduces the reported bug: the review-page Save persists the title field before saving,
    // flipping titleCustomized -> true even though the name is still the unedited auto default.
    saveCurrentPattern({
      fit: { sizingChart: "misses", selectedSize: "4" },
      style: { garmentStyle: "pullover", neckline: "round" },
      patternProject: { title: "Women's Sleeveless", notes: "", titleCustomized: true },
    });
    vi.mocked(listCustomPatternProjects).mockResolvedValue({
      ok: true,
      projects: [{ id: "p1", name: "Women's Sleeveless" } as never],
    });
    vi.mocked(createCustomPatternProject).mockResolvedValue({
      ok: true,
      project: { ...womensPullover, id: "p2", name: "Women's Sleeveless 2" },
    });

    const res = await smartSaveCustomPatternProject({
      mode: "create",
      resolveName: () => "Women's Sleeveless",
    });

    expect(res.ok).toBe(true);
    expect(createCustomPatternProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Women's Sleeveless 2" }),
    );
  });

  it("resolves the next number against the whole existing sequence", async () => {
    saveCurrentPattern({
      fit: { sizingChart: "misses", selectedSize: "4" },
      style: { garmentStyle: "pullover", neckline: "round" },
      patternProject: { title: "Women's Sleeveless", notes: "", titleCustomized: true },
    });
    vi.mocked(listCustomPatternProjects).mockResolvedValue({
      ok: true,
      projects: [
        { id: "p1", name: "Women's Sleeveless" } as never,
        { id: "p2", name: "women's sleeveless 2" } as never,
      ],
    });
    vi.mocked(createCustomPatternProject).mockResolvedValue({
      ok: true,
      project: { ...womensPullover, id: "p3", name: "Women's Sleeveless 3" },
    });

    // Draft title carries a numbered variant; numbering still resolves against the base sequence.
    await smartSaveCustomPatternProject({
      mode: "create",
      resolveName: () => "Women's Sleeveless 2",
    });

    expect(createCustomPatternProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Women's Sleeveless 3" }),
    );
  });

  it("does not renumber a manually customized name on create", async () => {
    savePatternProjectMeta({ title: "Mom's birthday vest", titleCustomized: true });
    vi.mocked(listCustomPatternProjects).mockResolvedValue({
      ok: true,
      projects: [{ id: "p1", name: "Mom's birthday vest" } as never],
    });
    vi.mocked(createCustomPatternProject).mockResolvedValue({
      ok: true,
      project: { ...womensPullover, id: "p2", name: "Mom's birthday vest" },
    });

    await smartSaveCustomPatternProject({
      mode: "create",
      resolveName: () => "Mom's birthday vest",
    });

    expect(createCustomPatternProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Mom's birthday vest" }),
    );
  });

  it("locks the saved name on the draft after create so edits do not auto-rename it", async () => {
    savePatternProjectMeta({ title: "Women's Sleeveless", titleCustomized: false });
    vi.mocked(createCustomPatternProject).mockResolvedValue({
      ok: true,
      project: { ...womensPullover, id: "p2", name: "Women's Sleeveless" },
    });

    await smartSaveCustomPatternProject({
      mode: "create",
      resolveName: () => "Women's Sleeveless",
    });

    const meta = getPatternProjectMeta();
    expect(meta.title).toBe("Women's Sleeveless");
    expect(meta.titleCustomized).toBe(true);
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

  it("copy creates a new project id without updating the original", async () => {
    writeActiveCustomPatternProjectId(womensPullover.id, womensPullover.name);
    vi.mocked(createCustomPatternProject).mockResolvedValue({
      ok: true,
      project: {
        ...womensPullover,
        id: "proj-womens-copy",
        name: "Women's Size 40 Pullover - Copy",
      },
    });

    const res = await smartSaveCustomPatternProject({
      mode: "copy",
      resolveName: () => womensPullover.name,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.created).toBe(true);
    expect(res.project.id).toBe("proj-womens-copy");
    expect(res.project.id).not.toBe(womensPullover.id);
    expect(createCustomPatternProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Women's Size 40 Pullover - Copy" }),
    );
    // Original is never updated by a copy.
    expect(updateCustomPatternProject).not.toHaveBeenCalled();
  });

  it("copied project becomes the active/open project after copy", async () => {
    writeActiveCustomPatternProjectId(womensPullover.id, womensPullover.name);
    vi.mocked(createCustomPatternProject).mockResolvedValue({
      ok: true,
      project: {
        ...womensPullover,
        id: "proj-womens-copy",
        name: "Women's Size 40 Pullover - Copy",
      },
    });

    await smartSaveCustomPatternProject({
      mode: "copy",
      resolveName: () => womensPullover.name,
    });

    expect(readActiveCustomPatternProjectId()).toBe("proj-womens-copy");
    expect(readActiveCustomPatternProjectLinkedName()).toBe("Women's Size 40 Pullover - Copy");
  });

  it("copy preserves the original sizing chart in the new project payload", async () => {
    writeActiveCustomPatternProjectId(womensPullover.id, womensPullover.name);
    // The working draft carries the original's sizing chart audience.
    vi.mocked(buildSavePayloadFromWorkingDraft).mockReturnValueOnce({
      name: "Women's Size 40 Pullover - Copy",
      notes: "",
      family: "sleeveless",
      source: "express",
      pattern: {
        style: { recipientCategory: "misses" },
        fit: { sizingChart: "misses", selectedSize: "40" },
      } as never,
      customOverrides: {},
    });
    vi.mocked(createCustomPatternProject).mockResolvedValue({
      ok: true,
      project: {
        ...womensPullover,
        id: "proj-womens-copy",
        name: "Women's Size 40 Pullover - Copy",
      },
    });

    await smartSaveCustomPatternProject({
      mode: "copy",
      resolveName: () => womensPullover.name,
    });

    const payload = vi.mocked(createCustomPatternProject).mock.calls[0]?.[0];
    expect(payload?.pattern.style).toMatchObject({ recipientCategory: "misses" });
    expect(payload?.pattern.fit).toMatchObject({ sizingChart: "misses", selectedSize: "40" });
  });

  it("copy increments the title when '- Copy' already exists", async () => {
    writeActiveCustomPatternProjectId(womensPullover.id, womensPullover.name);
    vi.mocked(listCustomPatternProjects).mockResolvedValue({
      ok: true,
      projects: [
        { id: womensPullover.id, name: womensPullover.name } as never,
        { id: "proj-copy-1", name: "Women's Size 40 Pullover - Copy" } as never,
      ],
    });
    vi.mocked(createCustomPatternProject).mockResolvedValue({
      ok: true,
      project: {
        ...womensPullover,
        id: "proj-womens-copy-2",
        name: "Women's Size 40 Pullover - Copy 2",
      },
    });

    await smartSaveCustomPatternProject({
      mode: "copy",
      resolveName: () => womensPullover.name,
    });

    expect(createCustomPatternProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Women's Size 40 Pullover - Copy 2" }),
    );
  });

  it("copy leaves the original record unchanged in storage", async () => {
    const store = new Map<string, typeof womensPullover>();
    store.set(womensPullover.id, { ...womensPullover });
    writeActiveCustomPatternProjectId(womensPullover.id, womensPullover.name);

    vi.mocked(listCustomPatternProjects).mockResolvedValue({
      ok: true,
      projects: [...store.values()].map((p) => ({ id: p.id, name: p.name }) as never),
    });
    vi.mocked(createCustomPatternProject).mockImplementation(async (payload) => {
      const project = {
        ...womensPullover,
        id: `proj-${store.size + 1}`,
        name: payload.name,
        pattern: payload.pattern as typeof womensPullover.pattern,
        customOverrides: payload.customOverrides ?? {},
      };
      store.set(project.id, project);
      return { ok: true, project };
    });

    await smartSaveCustomPatternProject({
      mode: "copy",
      resolveName: () => womensPullover.name,
    });

    const original = store.get(womensPullover.id);
    expect(original?.name).toBe("Women's Size 40 Pullover");
    expect(store.size).toBe(2);
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

  it("saving an edited gauge updates the same saved project id (no new record)", async () => {
    writeActiveCustomPatternProjectId(womensPullover.id, womensPullover.name);
    // Working draft now carries a changed gauge (e.g. knitter revised their swatch).
    vi.mocked(buildSavePayloadFromWorkingDraft).mockReturnValueOnce({
      name: womensPullover.name,
      notes: "",
      family: "sleeveless",
      source: "express",
      pattern: {
        style: { recipientCategory: "misses" },
        yarnGauge: { gaugeStitchRaw: "24", gaugeRowRaw: "32" },
      } as never,
      customOverrides: {},
    });
    vi.mocked(updateCustomPatternProject).mockResolvedValue({
      ok: true,
      project: { ...womensPullover },
    });

    const res = await smartSaveCustomPatternProject({
      mode: "update",
      resolveName: () => womensPullover.name,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.created).toBe(false);
    expect(createCustomPatternProject).not.toHaveBeenCalled();
    const payload = vi.mocked(updateCustomPatternProject).mock.calls[0]?.[0];
    expect(payload?.id).toBe("proj-womens-pullover");
    expect((payload?.pattern as { yarnGauge?: Record<string, string> })?.yarnGauge).toMatchObject({
      gaugeStitchRaw: "24",
      gaugeRowRaw: "32",
    });
    expect(readActiveCustomPatternProjectId()).toBe("proj-womens-pullover");
  });

  it("repeated ordinary saves keep a single project record in storage", async () => {
    const store = new Map<string, typeof womensPullover>();

    vi.mocked(createCustomPatternProject).mockImplementation(async (payload) => {
      const project = {
        ...womensPullover,
        id: `proj-${store.size + 1}`,
        name: payload.name,
        pattern: payload.pattern as typeof womensPullover.pattern,
        customOverrides: payload.customOverrides ?? {},
      };
      store.set(project.id, project);
      return { ok: true, project };
    });

    vi.mocked(updateCustomPatternProject).mockImplementation(async (payload) => {
      const existing = store.get(payload.id);
      if (!existing) return { ok: false, error: "missing" };
      const project = { ...existing, ...payload, name: payload.name };
      store.set(project.id, project);
      return { ok: true, project };
    });

    await smartSaveCustomPatternProject({ resolveName: () => womensPullover.name });
    await smartSaveCustomPatternProject({
      resolveName: () => "Women's Size 40 Pullover (revised)",
    });

    expect(store.size).toBe(1);
    expect([...store.keys()]).toEqual(["proj-1"]);
    expect([...store.values()][0]?.name).toBe("Women's Size 40 Pullover (revised)");
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
