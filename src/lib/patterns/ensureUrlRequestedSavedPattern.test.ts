import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import {
  readActiveCustomPatternProjectId,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import {
  getCurrentPattern,
  PATTERN_STORAGE_KEY,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";
import {
  HAT_DRAFT_STORAGE_KEY,
  createEmptyHatDraft,
  readHatDraft,
  writeHatDraft,
} from "./hat/hatDraft";
import { readHatActiveProjectId, writeHatActiveProjectId } from "./hat/hatSavedProject";

function sampleProject(
  id: string,
  title: string,
  style: Record<string, unknown>,
  fit: Record<string, unknown>,
): CustomPatternProject {
  return {
    id,
    name: title,
    family: "sleeveless",
    source: "express",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    version: 1,
    customOverrides: {},
    pattern: {
      id: `pattern-${id}`,
      patternType: "sleeveless",
      status: "draft",
      version: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      style: { garmentStyle: "pullover", neckline: "round", patternMode: "express", ...style },
      fit,
      yarnGauge: { gaugeStitchRaw: "20", gaugeRowRaw: "28" },
      measurements: {},
      machine: {},
      calculations: {},
      instructions: {},
      patternProject: { title, notes: "", titleCustomized: true },
    },
  };
}

// Pattern A: Kids' Drop Shoulder-ish sleeveless, 16 sts / 24 rows.
const PROJECT_A = sampleProject(
  "proj-a",
  "Kids Pattern A",
  { recipientCategory: "kids" },
  { sizingChart: "kids", selectedSize: "2 yr", easeChoice: "standard" },
);
// Pattern B: Women's, same construction (sleeveless express) but different data.
const PROJECT_B = sampleProject(
  "proj-b",
  "Women's Pattern B",
  { recipientCategory: "misses" },
  { sizingChart: "misses", selectedSize: "M", easeChoice: "standard" },
);

const loadCustomPatternProjectMock = vi.fn();
vi.mock("./customPatternProjectClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./customPatternProjectClient")>();
  return {
    ...actual,
    loadCustomPatternProject: (...args: unknown[]) => loadCustomPatternProjectMock(...args),
  };
});

import { ensureUrlRequestedSavedPatternHydrated } from "./ensureUrlRequestedSavedPattern";

function seedStalePatternAState(): void {
  // Simulate a previously-open Pattern A: working draft, active project link, and Express mirror all
  // point at A � exactly the state that used to leak through when navigating to a different pattern.
  localStorage.setItem(PATTERN_STORAGE_KEY, JSON.stringify(PROJECT_A.pattern));
  writeActiveCustomPatternProjectId(PROJECT_A.id, PROJECT_A.name);
  localStorage.setItem(
    SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
    JSON.stringify({ recipientCategory: "kids", selectedSize: "2 yr" }),
  );
}

describe("ensureUrlRequestedSavedPatternHydrated", () => {
  beforeEach(() => {
    stubLocalStorage();
    loadCustomPatternProjectMock.mockReset();
  });

  it("loads Pattern B when B's id is in the URL, even after Pattern A was open (same construction)", async () => {
    seedStalePatternAState();
    loadCustomPatternProjectMock.mockResolvedValue({ ok: true, project: PROJECT_B });

    const outcome = await ensureUrlRequestedSavedPatternHydrated({
      readUrlProjectId: () => PROJECT_B.id,
    });

    expect(outcome).toBe("loaded");
    expect(loadCustomPatternProjectMock).toHaveBeenCalledWith(PROJECT_B.id, "sleeveless");
    expect(getCurrentPattern().patternProject?.title).toBe("Women's Pattern B");
    expect(getCurrentPattern().fit?.selectedSize).toBe("M");
    // activeProjectId is synchronized to the URL-requested project.
    expect(readActiveCustomPatternProjectId()).toBe(PROJECT_B.id);
  });

  it("does not let a stale Express mirror for A survive when B's id is in the URL", async () => {
    seedStalePatternAState();
    loadCustomPatternProjectMock.mockResolvedValue({ ok: true, project: PROJECT_B });

    await ensureUrlRequestedSavedPatternHydrated({ readUrlProjectId: () => PROJECT_B.id });

    // The Express mirror was rehydrated from B (kids "2 yr" no longer present).
    const mirror = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY) ?? "";
    expect(mirror).not.toContain("2 yr");
    expect(getCurrentPattern().patternProject?.title).toBe("Women's Pattern B");
  });

  it("overrides a stale activeProjectId with the URL project id", async () => {
    // activeProjectId says A, but the URL requests B.
    writeActiveCustomPatternProjectId(PROJECT_A.id, PROJECT_A.name);
    loadCustomPatternProjectMock.mockResolvedValue({ ok: true, project: PROJECT_B });

    await ensureUrlRequestedSavedPatternHydrated({ readUrlProjectId: () => PROJECT_B.id });

    expect(readActiveCustomPatternProjectId()).toBe(PROJECT_B.id);
    expect(getCurrentPattern().patternProject?.title).toBe("Women's Pattern B");
  });

  it("reopens the same project on a direct reload of the saved-pattern URL", async () => {
    // No prior local state (fresh page load), only the URL id.
    loadCustomPatternProjectMock.mockResolvedValue({ ok: true, project: PROJECT_A });

    const outcome = await ensureUrlRequestedSavedPatternHydrated({
      readUrlProjectId: () => PROJECT_A.id,
    });

    expect(outcome).toBe("loaded");
    expect(getCurrentPattern().patternProject?.title).toBe("Kids Pattern A");
    expect(readActiveCustomPatternProjectId()).toBe(PROJECT_A.id);
  });

  it("is a no-op for new/unsaved patterns with no project id in the URL", async () => {
    seedStalePatternAState();

    const outcome = await ensureUrlRequestedSavedPatternHydrated({
      readUrlProjectId: () => "",
    });

    expect(outcome).toBe("no-url-project");
    expect(loadCustomPatternProjectMock).not.toHaveBeenCalled();
    // Existing working draft is untouched � normal reconciliation/self-heal still owns this case.
    expect(getCurrentPattern().patternProject?.title).toBe("Kids Pattern A");
    expect(readActiveCustomPatternProjectId()).toBe(PROJECT_A.id);
  });

  it("leaves an unsaved local Hat draft alone when the builder/summary has no project id", async () => {
    writeHatDraft(
      createEmptyHatDraft({
        sizeSel: "adult_woman",
        brimType: "single",
        patternProject: { title: "In-progress Hat", notes: "", titleCustomized: true },
      }),
    );
    writeHatActiveProjectId("", "");

    const outcome = await ensureUrlRequestedSavedPatternHydrated({
      readUrlProjectId: () => "",
    });

    expect(outcome).toBe("no-url-project");
    expect(loadCustomPatternProjectMock).not.toHaveBeenCalled();
    expect(readHatDraft()?.patternProject?.title).toBe("In-progress Hat");
    expect(readHatDraft()?.sizeSel).toBe("adult_woman");
  });

  it("hydrates a Hat from the URL project and does not keep a stale local Hat draft", async () => {
    writeHatDraft(
      createEmptyHatDraft({
        sizeSel: "preemie",
        brimType: "rolled",
        gaugeSlots: { inches: { stitch: "9", row: "12" }, cm: { stitch: "", row: "" } },
        patternProject: { title: "Stale Local Hat", notes: "", titleCustomized: true },
      }),
    );
    writeHatActiveProjectId("proj-stale", "Stale Local Hat");
    const savedHat = sampleProject("proj-hat-b", "Saved Camp Hat", {}, {});
    savedHat.pattern = {
      version: 1,
      patternType: "hat",
      patternSystem: "hat",
      unit: "inches",
      sizeSel: "adult_woman",
      customCircumference: "",
      brimType: "single",
      brimLength: "2",
      crownShaping: "gathered",
      fit: "watchcap",
      customHatLength: "",
      gaugeSlots: { inches: { stitch: "5", row: "7" }, cm: { stitch: "", row: "" } },
      availableNeedles: "200",
      showTips: false,
      updatedAt: "2026-01-02T00:00:00.000Z",
      patternProject: { title: "Saved Camp Hat", notes: "", titleCustomized: true },
    } as unknown as CustomPatternProject["pattern"];
    savedHat.name = "Saved Camp Hat";
    loadCustomPatternProjectMock.mockResolvedValue({ ok: true, project: savedHat });

    const outcome = await ensureUrlRequestedSavedPatternHydrated({
      readUrlProjectId: () => "proj-hat-b",
    });

    expect(outcome).toBe("loaded");
    expect(readHatDraft()?.patternProject?.title).toBe("Saved Camp Hat");
    expect(readHatDraft()?.gaugeSlots.inches).toEqual({ stitch: "5", row: "7" });
    expect(readHatActiveProjectId()).toBe("proj-hat-b");
    expect(localStorage.getItem(HAT_DRAFT_STORAGE_KEY)).not.toContain("Stale Local Hat");
  });

  it("strips the project id and falls back when the requested project cannot be loaded", async () => {
    const stripUrlProjectId = vi.fn();
    loadCustomPatternProjectMock.mockResolvedValue({ ok: false, error: "not found" });

    const outcome = await ensureUrlRequestedSavedPatternHydrated({
      readUrlProjectId: () => "proj-missing",
      stripUrlProjectId,
    });

    expect(outcome).toBe("load-failed");
    expect(stripUrlProjectId).toHaveBeenCalledTimes(1);
  });
});
