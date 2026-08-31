import { describe, expect, it } from "vitest";
import {
  buildProjectRecord,
  listProjectSummaries,
  listProjectSummariesFromBlobScan,
  projectBlobKey,
  projectIndexKey,
  sortProjectSummaries,
  summaryFromProject,
  upsertProjectSummaryInIndex,
  writeProjectSummaryIndex,
} from "../../../netlify/functions/lib/custom-pattern-projects-store.js";

const FAMILY = "sleeveless";
const USER_ID = "member_test_1";

const SUMMARY_SHAPE_KEYS = [
  "id",
  "name",
  "family",
  "source",
  "patternSystem",
  "createdAt",
  "updatedAt",
  "version",
] as const;

function sampleProject(overrides: Record<string, unknown> = {}) {
  return {
    id: "proj-1",
    name: "Test Vest",
    family: FAMILY,
    source: "custom-build",
    createdAt: "2025-01-01T10:00:00.000Z",
    updatedAt: "2025-01-02T10:00:00.000Z",
    version: 1,
    pattern: { patternType: "sleeveless" },
    customOverrides: {},
    _storageUserId: USER_ID,
    ...overrides,
  };
}

type MockStore = {
  get: (key: string, options?: { type?: string }) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  list: (options: { prefix: string }) => Promise<{ blobs: { key: string }[] }>;
  data: Map<string, string>;
  getCalls: string[];
};

function createMockStore(initial: Record<string, string> = {}): MockStore {
  const data = new Map(Object.entries(initial));
  const getCalls: string[] = [];
  return {
    data,
    getCalls,
    async get(key, options = {}) {
      getCalls.push(key);
      const value = data.get(key);
      if (value === undefined) return null;
      return options.type === "text" || !options.type ? value : value;
    },
    async set(key, value) {
      data.set(key, value);
    },
    async list({ prefix }) {
      const blobs: { key: string }[] = [];
      for (const key of data.keys()) {
        if (key.startsWith(prefix)) blobs.push({ key });
      }
      return { blobs };
    },
  };
}

function putProject(store: MockStore, project: ReturnType<typeof sampleProject>) {
  const key = projectBlobKey(FAMILY, USER_ID, project.id as string);
  store.data.set(key, JSON.stringify(project));
}

describe("custom pattern project summary index", () => {
  it("summaryFromProject returns the list response shape fields", () => {
    const summary = summaryFromProject(sampleProject());
    for (const key of SUMMARY_SHAPE_KEYS) {
      expect(summary).toHaveProperty(key);
    }
    expect(Object.keys(summary).sort()).toEqual([...SUMMARY_SHAPE_KEYS].sort());
  });

  it("summaryFromProject derives display gauge from the saved yarnGauge", () => {
    const summary = summaryFromProject(
      sampleProject({
        pattern: {
          patternType: "sleeveless",
          yarnGauge: { stitchGauge: "7", rowGauge: "11" },
        },
      }),
    );
    expect(summary.gauge).toEqual({ stitchesPerInch: 7, rowsPerInch: 11 });
  });

  it("summaryFromProject keeps original entered swatch counts for display", () => {
    const summary = summaryFromProject(
      sampleProject({
        pattern: {
          patternType: "sleeveless",
          yarnGauge: {
            gaugeStitchRaw: "28",
            gaugeRowRaw: "44",
            gaugeRawUnit: "in",
            stitchGauge: "7",
            rowGauge: "11",
          },
        },
      }),
    );
    expect(summary.gauge).toEqual({
      stitchesPerInch: 7,
      rowsPerInch: 11,
      displayStitches: 28,
      displayRows: 44,
    });
  });

  it("summaryFromProject omits gauge when the pattern has none", () => {
    const summary = summaryFromProject(sampleProject());
    expect(summary).not.toHaveProperty("gauge");
  });

  it("summaryFromProject derives Hat gauge from gaugeSlots", () => {
    const summary = summaryFromProject(
      sampleProject({
        name: "Camp Hat",
        pattern: {
          patternType: "hat",
          patternSystem: "hat",
          unit: "inches",
          gaugeSlots: { inches: { stitch: "5", row: "7" }, cm: { stitch: "", row: "" } },
        },
      }),
    );
    expect(summary.patternSystem).toBe("hat");
    expect(summary.gauge).toEqual({
      stitchesPerInch: 1.25,
      rowsPerInch: 1.75,
      displayStitches: 5,
      displayRows: 7,
    });
  });

  it("does not classify a sweater named Hat as hat", () => {
    const summary = summaryFromProject(
      sampleProject({
        name: "Hat",
        family: "sleeveless",
        pattern: { patternType: "sleeveless", style: {} },
      }),
    );
    expect(summary.patternSystem).toBe("sleeveless");
  });

  it("create → buildProjectRecord → index summary keeps family sleeveless and patternSystem socks", async () => {
    const built = buildProjectRecord(
      {
        name: "Aubrie's Hiking Socks",
        family: "sleeveless",
        source: "express",
        pattern: { patternType: "socks", patternSystem: "socks" },
        customOverrides: {},
      },
      USER_ID,
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const store = createMockStore();
    await upsertProjectSummaryInIndex(store, built.project.family as string, USER_ID, built.project);
    const indexed = await listProjectSummaries(store, FAMILY, USER_ID);
    expect(indexed).toHaveLength(1);
    expect(indexed[0]).toMatchObject({
      name: "Aubrie's Hiking Socks",
      family: "sleeveless",
      patternSystem: "socks",
    });
  });

  it("create → buildProjectRecord → index summary keeps family sleeveless and patternSystem hat", async () => {
    const built = buildProjectRecord(
      {
        name: "Camp Hat",
        family: "sleeveless",
        source: "express",
        pattern: { patternType: "hat", patternSystem: "hat" },
        customOverrides: {},
      },
      USER_ID,
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const store = createMockStore();
    await upsertProjectSummaryInIndex(store, built.project.family as string, USER_ID, built.project);
    const indexed = await listProjectSummaries(store, FAMILY, USER_ID);
    expect(indexed).toHaveLength(1);
    expect(indexed[0]).toMatchObject({
      name: "Camp Hat",
      family: "sleeveless",
      patternSystem: "hat",
    });
  });

  it("sortProjectSummaries orders newest updatedAt first", () => {
    const sorted = sortProjectSummaries([
      summaryFromProject(sampleProject({ id: "a", updatedAt: "2025-01-01T00:00:00.000Z" })),
      summaryFromProject(sampleProject({ id: "b", updatedAt: "2025-03-01T00:00:00.000Z" })),
      summaryFromProject(sampleProject({ id: "c", updatedAt: "2025-02-01T00:00:00.000Z" })),
    ]);
    expect(sorted.map((row) => row.id)).toEqual(["b", "c", "a"]);
  });

  it("listProjectSummaries reads from index when present without reading project blobs", async () => {
    const store = createMockStore();
    const summaries = sortProjectSummaries([
      summaryFromProject(sampleProject({ id: "indexed-1", name: "From Index" })),
    ]);
    await writeProjectSummaryIndex(store, FAMILY, USER_ID, summaries);

    const result = await listProjectSummaries(store, FAMILY, USER_ID);

    expect(result).toEqual(summaries);
    const projectKey = projectBlobKey(FAMILY, USER_ID, "indexed-1");
    expect(store.getCalls).not.toContain(projectKey);
  });

  it("missing index falls back to blob scan and writes index", async () => {
    const store = createMockStore();
    putProject(store, sampleProject({ id: "legacy-1", name: "Legacy Vest" }));
    putProject(
      store,
      sampleProject({
        id: "legacy-2",
        name: "Older Vest",
        updatedAt: "2024-12-01T00:00:00.000Z",
      }),
    );

    const result = await listProjectSummaries(store, FAMILY, USER_ID);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("legacy-1");
    expect(result.map((row) => row.id)).toContain("legacy-2");

    const indexKey = projectIndexKey(FAMILY, USER_ID);
    expect(store.data.has(indexKey)).toBe(true);
    const indexRaw = store.data.get(indexKey);
    expect(indexRaw).toBeTruthy();
    const indexParsed = JSON.parse(indexRaw!);
    expect(indexParsed.summaries).toHaveLength(2);
  });

  it("empty index falls back to blob scan and rebuilds index", async () => {
    const store = createMockStore();
    const indexKey = projectIndexKey(FAMILY, USER_ID);
    store.data.set(
      indexKey,
      JSON.stringify({ version: 1, updatedAt: "2025-01-01T00:00:00.000Z", summaries: [] }),
    );
    putProject(store, sampleProject({ id: "only-one", name: "Recovered" }));

    const result = await listProjectSummaries(store, FAMILY, USER_ID);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Recovered");
    const rebuilt = JSON.parse(store.data.get(indexKey)!);
    expect(rebuilt.summaries).toHaveLength(1);
  });

  it("upsertProjectSummaryInIndex creates index on first save", async () => {
    const store = createMockStore();
    putProject(store, sampleProject({ id: "new-save", name: "Brand New" }));

    await upsertProjectSummaryInIndex(store, FAMILY, USER_ID, sampleProject({ id: "new-save", name: "Brand New" }));

    const indexKey = projectIndexKey(FAMILY, USER_ID);
    expect(store.data.has(indexKey)).toBe(true);
    const indexParsed = JSON.parse(store.data.get(indexKey)!);
    expect(indexParsed.summaries).toEqual([
      expect.objectContaining({ id: "new-save", name: "Brand New" }),
    ]);
  });

  it("upsertProjectSummaryInIndex updates an existing summary on update", async () => {
    const store = createMockStore();
    putProject(store, sampleProject({ id: "saved-1", name: "Before", version: 1 }));
    await writeProjectSummaryIndex(store, FAMILY, USER_ID, [
      summaryFromProject(sampleProject({ id: "saved-1", name: "Before", version: 1 })),
    ]);

    putProject(
      store,
      sampleProject({
        id: "saved-1",
        name: "After Rename",
        version: 2,
        updatedAt: "2025-06-01T12:00:00.000Z",
      }),
    );
    await upsertProjectSummaryInIndex(
      store,
      FAMILY,
      USER_ID,
      sampleProject({
        id: "saved-1",
        name: "After Rename",
        version: 2,
        updatedAt: "2025-06-01T12:00:00.000Z",
      }),
    );

    const indexParsed = JSON.parse(store.data.get(projectIndexKey(FAMILY, USER_ID))!);
    expect(indexParsed.summaries).toHaveLength(1);
    expect(indexParsed.summaries[0]).toMatchObject({
      id: "saved-1",
      name: "After Rename",
      version: 2,
      updatedAt: "2025-06-01T12:00:00.000Z",
    });
  });

  it("listProjectSummariesFromBlobScan skips index.json and keeps summary shape", async () => {
    const store = createMockStore();
    putProject(store, sampleProject());
    await writeProjectSummaryIndex(store, FAMILY, USER_ID, [summaryFromProject(sampleProject())]);

    const result = await listProjectSummariesFromBlobScan(store, FAMILY, USER_ID);

    expect(result).toHaveLength(1);
    for (const key of SUMMARY_SHAPE_KEYS) {
      expect(result[0]).toHaveProperty(key);
    }
    expect(result[0].name).toBe("Test Vest");
  });
});
