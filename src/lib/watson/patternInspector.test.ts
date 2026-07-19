import fs from "fs";
import path from "path";

import { describe, expect, it, vi } from "vitest";

import {
  DROP_SHOULDER_CONSTRUCTION,
  CONSTRUCTION_AUTHORED_KEY,
} from "../patterns/patternConstructionIdentity";
import {
  buildPatternInspectorSettings,
  buildPatternInspectorSummary,
  extractProjectNotes,
  formatProjectJsonForDisplay,
  inspectSavedPatternByProjectId,
  notFoundMessage,
  PATTERN_INSPECTOR_BLOB_STORE,
  PATTERN_INSPECTOR_PREFIX,
  type PatternInspectorBlobStore,
} from "./patternInspector";

const PROJECT_ID = "e77c684f-c097-4400-aa85-52e4e2e315c8";

function sampleProject(overrides: Record<string, unknown> = {}) {
  return {
    id: PROJECT_ID,
    name: "Sue Drop Shoulder",
    notes: "Try softer yarn",
    family: "sleeveless",
    source: "custom-build",
    createdAt: "2026-06-01T12:00:00.000Z",
    updatedAt: "2026-06-02T15:30:00.000Z",
    version: 3,
    customOverrides: {
      constructionFamily: DROP_SHOULDER_CONSTRUCTION,
    },
    pattern: {
      style: {
        construction: DROP_SHOULDER_CONSTRUCTION,
        [CONSTRUCTION_AUTHORED_KEY]: DROP_SHOULDER_CONSTRUCTION,
        neckline: "round",
        bodyShape: "straight",
        patternMode: "custom-build",
        sleeveLength: "long",
      },
      fit: {
        selectedSize: "M",
        fitPreference: "standard",
        selectedMeasurements: {
          neck_width: 7.5,
          shoulder_width: 15,
          finished_bust_chest: 40,
          hip: 42,
          armhole_depth: 8,
          front_neck_depth: 3,
          back_neck_depth: 1,
        },
        cbMeasurementOverrides: {
          armholeDepth: "8.25",
          shoulderWidth: "15.5",
        },
      },
      yarnGauge: {
        gaugeStitchRaw: "20",
        gaugeRowRaw: "28",
        gaugeRawUnit: "in",
      },
      measurements: {},
      patternProject: {
        notes: "nested note should lose to top-level",
      },
    },
    ...overrides,
  };
}

function mockStore(options: {
  keys: string[];
  blobs?: Record<string, string>;
}): PatternInspectorBlobStore {
  const calls = {
    list: 0,
    get: 0,
    set: 0,
    delete: 0,
  };

  const store: PatternInspectorBlobStore & {
    set?: (...args: unknown[]) => unknown;
    delete?: (...args: unknown[]) => unknown;
    calls: typeof calls;
  } = {
    calls,
    async list({ prefix }) {
      calls.list += 1;
      expect(prefix).toBe(PATTERN_INSPECTOR_PREFIX);
      return {
        blobs: options.keys.filter((key) => key.startsWith(prefix)).map((key) => ({ key })),
      };
    },
    async get(key, opts) {
      calls.get += 1;
      expect(opts).toEqual({ type: "text" });
      return options.blobs?.[key] ?? null;
    },
    set() {
      calls.set += 1;
      throw new Error("set must not be called");
    },
    delete() {
      calls.delete += 1;
      throw new Error("delete must not be called");
    },
  };

  return store;
}

describe("inspectSavedPatternByProjectId", () => {
  it("rejects an invalid UUID without listing blobs", async () => {
    const store = mockStore({ keys: [] });
    const result = await inspectSavedPatternByProjectId("not-a-uuid", {
      getProjectsStore: () => store,
    });
    expect(result.status).toBe("invalid");
    expect(store.calls?.list ?? 0).toBe(0);
  });

  it("accepts a valid UUID and reports no match", async () => {
    const store = mockStore({
      keys: [`sleeveless/mem_other/11111111-2222-3333-4444-555555555555.json`],
    });
    const result = await inspectSavedPatternByProjectId(PROJECT_ID, {
      getProjectsStore: () => store,
    });
    expect(result.status).toBe("none");
    if (result.status === "none") {
      expect(result.store).toBe(PATTERN_INSPECTOR_BLOB_STORE);
      expect(result.prefix).toBe(PATTERN_INSPECTOR_PREFIX);
      expect(result.message).toContain("deleted");
      expect(result.message).toContain("never cloud-saved");
      expect(result.message).toContain("another environment");
      expect(result.message).toContain("copied incorrectly");
    }
  });

  it("returns one match with summary, settings, and member id from the blob key", async () => {
    const project = sampleProject();
    const blobKey = `sleeveless/mem_cynthia/${PROJECT_ID}.json`;
    const store = mockStore({
      keys: [blobKey, `sleeveless/mem_cynthia/index.json`],
      blobs: { [blobKey]: JSON.stringify(project) },
    });

    const result = await inspectSavedPatternByProjectId(PROJECT_ID, {
      getProjectsStore: () => store,
    });

    expect(result.status).toBe("one");
    if (result.status !== "one") return;

    expect(result.blobKey).toBe(blobKey);
    expect(result.memberstackUserId).toBe("mem_cynthia");
    expect(result.memberstackProfileHref).toBe("/watson/customers/memberstack/mem_cynthia");
    expect(result.summary.some((row) => row.label === "Pattern name" && row.value === "Sue Drop Shoulder")).toBe(
      true,
    );
    expect(
      result.summary.some(
        (row) => row.label === "Pattern system / construction" && row.value === "Drop Shoulder",
      ),
    ).toBe(true);
    expect(result.settings.some((row) => row.label === "Selected size" && row.value === "M")).toBe(
      true,
    );
    expect(result.settings.some((row) => row.label === "Neck width" && row.value === "7.5")).toBe(
      true,
    );
    expect(
      result.customBuildOverrides.some((row) => row.label === "armholeDepth" && row.value === "8.25"),
    ).toBe(true);
    expect(result.notes).toBe("Try softer yarn");
    expect(result.rawJson).toContain("Sue Drop Shoulder");
    expect(result.sanitizedSettingsText).toContain("Selected size: M");
    expect(store.calls?.set).toBe(0);
    expect(store.calls?.delete).toBe(0);
  });

  it("finds Drop Shoulder projects under the shared sleeveless family", async () => {
    const project = sampleProject();
    const blobKey = `sleeveless/mem_drop/${PROJECT_ID}.json`;
    const store = mockStore({
      keys: [blobKey],
      blobs: { [blobKey]: JSON.stringify(project) },
    });

    const result = await inspectSavedPatternByProjectId(PROJECT_ID, {
      getProjectsStore: () => store,
    });

    expect(result.status).toBe("one");
    if (result.status === "one") {
      expect(result.prefix).toBe("sleeveless/");
      expect(result.blobKey.startsWith("sleeveless/")).toBe(true);
      expect(result.summary.some((row) => row.value === "Drop Shoulder")).toBe(true);
    }
  });

  it("returns all matching keys when multiple blobs match and does not get any", async () => {
    const store = mockStore({
      keys: [
        `sleeveless/mem_a/${PROJECT_ID}.json`,
        `sleeveless/mem_b/${PROJECT_ID}.json`,
      ],
    });
    const getSpy = vi.spyOn(store, "get");

    const result = await inspectSavedPatternByProjectId(PROJECT_ID, {
      getProjectsStore: () => store,
    });

    expect(result.status).toBe("many");
    if (result.status === "many") {
      expect(result.matchingKeys).toHaveLength(2);
      expect(result.message).toContain("Refusing to guess");
    }
    expect(getSpy).not.toHaveBeenCalled();
  });
});

describe("pattern inspector display helpers", () => {
  it("builds summary and settings rows from saved project fields", () => {
    const project = sampleProject();
    const summary = buildPatternInspectorSummary({
      project,
      projectId: PROJECT_ID,
      blobKey: `sleeveless/mem_cynthia/${PROJECT_ID}.json`,
      sizeBytes: 1200,
      memberstackUserId: "mem_cynthia",
    });
    const settings = buildPatternInspectorSettings(project);

    expect(summary.find((row) => row.label === "Memberstack user ID")?.value).toBe("mem_cynthia");
    expect(settings.find((row) => row.label === "Bust / chest")?.value).toBe("40");
    expect(settings.find((row) => row.label === "Hem / hip width")?.value).toBe("42");
    expect(extractProjectNotes(project)).toBe("Try softer yarn");
  });

  it("formats raw JSON for safe text rendering", () => {
    const raw = formatProjectJsonForDisplay({
      name: '<script>alert("x")</script>',
      id: PROJECT_ID,
    });
    expect(raw).toContain("<script>alert");
    expect(raw).toContain("</script>");
    expect(raw).toContain("\n");
    // Astro templates escape `{rawJson}` as text; page must not use set:html for JSON.
    const page = fs.readFileSync(
      path.resolve("src/pages/watson/pattern-inspector.astro"),
      "utf8",
    );
    expect(page).toContain('<pre class="watson-pattern-inspector__json">{result.rawJson}</pre>');
    expect(page).not.toContain("set:html");
  });

  it("explains not-found reasons in support-friendly language", () => {
    const message = notFoundMessage(PROJECT_ID);
    expect(message).toContain("deleted");
    expect(message).toContain("never cloud-saved");
    expect(message).toContain("another environment");
    expect(message).toContain("copied incorrectly");
  });
});

describe("pattern inspector source safety", () => {
  it("uses only list and get against a fixed store and prefix", () => {
    const source = fs.readFileSync(path.resolve("src/lib/watson/patternInspector.ts"), "utf8");
    expect(source).toContain('PATTERN_INSPECTOR_BLOB_STORE = "custom-pattern-projects"');
    expect(source).toContain('PATTERN_INSPECTOR_FAMILY = "sleeveless"');
    expect(source).toContain("store.list({ prefix })");
    expect(source).toContain('store.get(blobKey, { type: "text" })');
    expect(source).not.toMatch(/store\.set\s*\(/);
    expect(source).not.toMatch(/store\.delete\s*\(/);
    expect(source).not.toMatch(/store\.setJSON\s*\(/);
    expect(source).not.toContain("NETLIFY_AUTH_TOKEN");
    expect(source).not.toContain("siteID");
    expect(source).not.toContain("token:");
  });

  it("does not accept store name or prefix from user input", () => {
    const source = fs.readFileSync(path.resolve("src/lib/watson/patternInspector.ts"), "utf8");
    expect(source).toContain("prefix: PATTERN_INSPECTOR_PREFIX");
    expect(source).not.toMatch(/searchParams\.get\(["']store/);
    expect(source).not.toMatch(/searchParams\.get\(["']prefix/);
    expect(source).not.toMatch(/searchParams\.get\(["']family/);
  });
});
