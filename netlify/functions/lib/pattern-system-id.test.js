import { describe, expect, it } from "vitest";
import {
  CONSTRUCTION_AUTHORED_KEY,
  DROP_SHOULDER_CONSTRUCTION,
  resolvePatternSystemFromProject,
} from "./pattern-system-id.js";
import {
  buildProjectRecord,
  listProjectSummaries,
  projectIndexKey,
  summaryFromProject,
  upsertProjectSummaryInIndex,
} from "./custom-pattern-projects-store.js";

function createMockStore(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    async get(key) {
      return data.has(key) ? data.get(key) : null;
    },
    async set(key, value) {
      data.set(key, value);
    },
    async list({ prefix }) {
      const blobs = [];
      for (const key of data.keys()) {
        if (key.startsWith(prefix)) blobs.push({ key });
      }
      return { blobs };
    },
  };
}

describe("resolvePatternSystemFromProject (server index classifier)", () => {
  it("classifies a Hat stored under family sleeveless by patternType/patternSystem", () => {
    expect(
      resolvePatternSystemFromProject({
        family: "sleeveless",
        pattern: { patternType: "hat", patternSystem: "hat" },
        customOverrides: {},
      }),
    ).toBe("hat");
    expect(
      resolvePatternSystemFromProject({
        family: "sleeveless",
        pattern: { patternType: "hat" },
        customOverrides: {},
      }),
    ).toBe("hat");
    expect(
      resolvePatternSystemFromProject({
        family: "sleeveless",
        pattern: { patternSystem: "hat" },
        customOverrides: {},
      }),
    ).toBe("hat");
  });

  it("classifies a normal Sleeveless sweater as sleeveless", () => {
    expect(
      resolvePatternSystemFromProject({
        family: "sleeveless",
        pattern: { patternType: "sleeveless", style: { patternMode: "express" } },
        customOverrides: {},
      }),
    ).toBe("sleeveless");
  });

  it("does not classify a project named Hat without Hat identity fields", () => {
    expect(
      resolvePatternSystemFromProject({
        name: "Hat",
        family: "sleeveless",
        pattern: { patternType: "sleeveless", style: {} },
        customOverrides: {},
      }),
    ).toBe("sleeveless");
  });

  it("keeps Drop Shoulder classification unchanged", () => {
    expect(
      resolvePatternSystemFromProject({
        family: "sleeveless",
        pattern: {
          patternType: "sleeveless",
          style: {
            construction: DROP_SHOULDER_CONSTRUCTION,
            [CONSTRUCTION_AUTHORED_KEY]: DROP_SHOULDER_CONSTRUCTION,
          },
        },
        customOverrides: {},
      }),
    ).toBe("drop-shoulder");
  });
});

describe("summaryFromProject index patternSystem", () => {
  it("writes patternSystem hat for a Hat blob with family sleeveless", () => {
    const summary = summaryFromProject({
      id: "proj-hat-1",
      name: "Camp Hat",
      family: "sleeveless",
      source: "express",
      createdAt: "2026-08-22T00:00:00.000Z",
      updatedAt: "2026-08-22T00:00:00.000Z",
      version: 1,
      pattern: { patternType: "hat", patternSystem: "hat" },
      customOverrides: {},
    });
    expect(summary.family).toBe("sleeveless");
    expect(summary.patternSystem).toBe("hat");
  });

  it("writes patternSystem sleeveless for a sweater named Hat", () => {
    const summary = summaryFromProject({
      id: "proj-sl-1",
      name: "Hat",
      family: "sleeveless",
      source: "express",
      createdAt: "2026-08-22T00:00:00.000Z",
      updatedAt: "2026-08-22T00:00:00.000Z",
      version: 1,
      pattern: { patternType: "sleeveless", style: {} },
      customOverrides: {},
    });
    expect(summary.patternSystem).toBe("sleeveless");
  });

  it("create → buildProjectRecord → summary/index writes patternSystem hat", async () => {
    const built = buildProjectRecord(
      {
        name: "Camp Hat",
        family: "sleeveless",
        source: "express",
        pattern: { patternType: "hat", patternSystem: "hat" },
        customOverrides: {},
      },
      "user-1",
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    expect(built.project.family).toBe("sleeveless");
    expect(built.project.pattern.patternType).toBe("hat");
    expect(built.project.pattern.patternSystem).toBe("hat");

    const summary = summaryFromProject(built.project);
    expect(summary.family).toBe("sleeveless");
    expect(summary.patternSystem).toBe("hat");

    const store = createMockStore();
    await upsertProjectSummaryInIndex(store, built.project.family, "user-1", built.project);
    const indexed = await listProjectSummaries(store, "sleeveless", "user-1");
    expect(indexed).toEqual([expect.objectContaining({ id: built.project.id, patternSystem: "hat" })]);
    expect(store.data.has(projectIndexKey("sleeveless", "user-1"))).toBe(true);
  });
});
