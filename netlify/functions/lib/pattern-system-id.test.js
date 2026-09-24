import { describe, expect, it } from "vitest";
import {
  CONSTRUCTION_AUTHORED_KEY,
  CONSTRUCTION_FAMILY_OVERRIDE_KEY,
  DROP_SHOULDER_CONSTRUCTION,
  patternSystemDisplayName,
  resolvePatternSystemFromProject,
  SIDEWAYS_CARDIGAN_CONSTRUCTION,
} from "./pattern-system-id.js";
import {
  buildProjectRecord,
  countProjectsForPatternSystem,
  listProjectSummaries,
  projectBlobKey,
  projectIndexKey,
  PROJECT_SUMMARY_INDEX_VERSION,
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

  it("classifies Socks stored under family sleeveless by patternType/patternSystem", () => {
    expect(
      resolvePatternSystemFromProject({
        family: "sleeveless",
        pattern: { patternType: "socks", patternSystem: "socks" },
        customOverrides: {},
      }),
    ).toBe("socks");
    expect(
      resolvePatternSystemFromProject({
        family: "sleeveless",
        pattern: { patternType: "socks" },
        customOverrides: {},
      }),
    ).toBe("socks");
    expect(
      resolvePatternSystemFromProject({
        family: "sleeveless",
        pattern: { patternSystem: "socks" },
        customOverrides: {},
      }),
    ).toBe("socks");
    expect(
      resolvePatternSystemFromProject({
        family: "sleeveless",
        pattern: { patternType: "sock", patternSystem: "socks" },
        customOverrides: {},
      }),
    ).toBe("socks");
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

  it("does not classify a sweater named Socks as socks", () => {
    expect(
      resolvePatternSystemFromProject({
        name: "Socks",
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

  it("create → buildProjectRecord → summary/index writes patternSystem socks", async () => {
    const built = buildProjectRecord(
      {
        name: "Aubrie's Hiking Socks",
        family: "sleeveless",
        source: "express",
        pattern: {
          patternType: "socks",
          patternSystem: "socks",
          patternProject: { title: "Aubrie's Hiking Socks", notes: "", titleCustomized: true },
        },
        customOverrides: {},
      },
      "user-1",
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    expect(built.project.family).toBe("sleeveless");
    expect(built.project.pattern.patternType).toBe("socks");
    expect(built.project.pattern.patternSystem).toBe("socks");
    expect(built.project.pattern.patternProject?.title).toBe("Aubrie's Hiking Socks");
    expect(built.project.name).toBe("Aubrie's Hiking Socks");

    const summary = summaryFromProject(built.project);
    expect(summary.family).toBe("sleeveless");
    expect(summary.patternSystem).toBe("socks");

    const store = createMockStore();
    await upsertProjectSummaryInIndex(store, built.project.family, "user-1", built.project);
    const indexed = await listProjectSummaries(store, "sleeveless", "user-1");
    expect(indexed).toEqual([
      expect.objectContaining({ id: built.project.id, patternSystem: "socks" }),
    ]);
  });

  it("classifies a Sideways blob as sideways-cardigan and leaves Sleeveless unchanged", () => {
    const sideways = {
      family: "sleeveless",
      name: "new Women's Sideways V-Neck",
      pattern: {
        style: {
          construction: SIDEWAYS_CARDIGAN_CONSTRUCTION,
          [CONSTRUCTION_AUTHORED_KEY]: SIDEWAYS_CARDIGAN_CONSTRUCTION,
        },
      },
      customOverrides: {},
    };
    expect(resolvePatternSystemFromProject(sideways)).toBe("sideways-cardigan");
    expect(patternSystemDisplayName("sideways-cardigan")).toBe("Sideways V-Neck");
    expect(
      resolvePatternSystemFromProject({
        family: "sleeveless",
        pattern: { style: { patternMode: "express", neckline: "round" } },
        customOverrides: {},
      }),
    ).toBe("sleeveless");
    expect(
      resolvePatternSystemFromProject({
        ...sideways,
        pattern: {
          style: { construction: SIDEWAYS_CARDIGAN_CONSTRUCTION },
        },
        customOverrides: {
          [CONSTRUCTION_FAMILY_OVERRIDE_KEY]: SIDEWAYS_CARDIGAN_CONSTRUCTION,
        },
      }),
    ).toBe("sideways-cardigan");
  });

  it("writes patternSystem sideways-cardigan and does not count it as Sleeveless", () => {
    const summary = summaryFromProject({
      id: "proj-sw-1",
      name: "new Women's Sideways V-Neck",
      family: "sleeveless",
      source: "express",
      createdAt: "2026-09-24T00:00:00.000Z",
      updatedAt: "2026-09-24T00:00:00.000Z",
      version: 1,
      pattern: {
        style: {
          construction: SIDEWAYS_CARDIGAN_CONSTRUCTION,
          [CONSTRUCTION_AUTHORED_KEY]: SIDEWAYS_CARDIGAN_CONSTRUCTION,
        },
      },
      customOverrides: {},
    });
    expect(summary.patternSystem).toBe("sideways-cardigan");
    expect(summary.name).toBe("new Women's Sideways V-Neck");
    const sleeveless = summaryFromProject({
      id: "proj-sl-2",
      name: "Summer shell",
      family: "sleeveless",
      source: "express",
      pattern: { style: { patternMode: "express" } },
      customOverrides: {},
    });
    expect(sleeveless.patternSystem).toBe("sleeveless");
    expect(countProjectsForPatternSystem([summary, sleeveless], "sleeveless")).toBe(1);
    expect(countProjectsForPatternSystem([summary, sleeveless], "sideways-cardigan")).toBe(1);
  });

  it("rebuilds a stale Sleeveless index label from the Sideways project blob", async () => {
    const project = {
      id: "proj-sw-stale",
      name: "new Women's Sideways V-Neck",
      family: "sleeveless",
      source: "express",
      createdAt: "2026-09-24T00:00:00.000Z",
      updatedAt: "2026-09-24T00:00:00.000Z",
      version: 1,
      pattern: {
        style: {
          construction: SIDEWAYS_CARDIGAN_CONSTRUCTION,
          [CONSTRUCTION_AUTHORED_KEY]: SIDEWAYS_CARDIGAN_CONSTRUCTION,
        },
      },
      customOverrides: {},
    };
    const blobKey = projectBlobKey("sleeveless", "user-1", project.id);
    const indexKey = projectIndexKey("sleeveless", "user-1");
    const store = createMockStore({
      [blobKey]: JSON.stringify(project),
      [indexKey]: JSON.stringify({
        version: PROJECT_SUMMARY_INDEX_VERSION - 1,
        summaries: [{ id: project.id, name: project.name, family: "sleeveless", patternSystem: "sleeveless" }],
      }),
    });
    const listed = await listProjectSummaries(store, "sleeveless", "user-1");
    expect(listed).toEqual([
      expect.objectContaining({ id: project.id, patternSystem: "sideways-cardigan", name: project.name }),
    ]);
  });
});
