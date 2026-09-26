import { describe, expect, it } from "vitest";
import { BABY_KIDS_LENGTH_MATCH_RULES } from "./babyKidsLengthErrata";
import { scanPatternErrataImpact, type PatternErrataImpactStore } from "./patternErrataImpact";

const errata = {
  affectedBuilders: ["drop-shoulder", "sleeveless"] as const,
  matchRules: BABY_KIDS_LENGTH_MATCH_RULES,
};

function blob(project: unknown): string {
  return JSON.stringify(project);
}

function sweater(options: {
  id: string;
  owner: string;
  audience: string;
  size: string;
  length: number;
  createdAt: string;
}) {
  return {
    key: `sleeveless/${options.owner}/${options.id}.json`,
    body: blob({
      id: options.id,
      name: options.id,
      createdAt: options.createdAt,
      pattern: {
        patternType: "sleeveless",
        style: {
          construction: "drop-shoulder",
          constructionAuthored: "drop-shoulder",
          recipientCategory: options.audience,
        },
        fit: {
          sizingChart: options.audience,
          selectedSize: options.size,
          selectedMeasurements: { back_neck_to_hem: options.length },
        },
      },
    }),
  };
}

describe("scanPatternErrataImpact", () => {
  it("counts old defaults separately from customized and uncertain patterns and does not write", async () => {
    const files = [
      sweater({
        id: "old-baby",
        owner: "member-a",
        audience: "baby",
        size: "3 mo",
        length: 6,
        createdAt: "2026-02-01T00:00:00.000Z",
      }),
      sweater({
        id: "old-kids",
        owner: "member-a",
        audience: "kids",
        size: "4 yr",
        length: 19.5,
        createdAt: "2026-02-02T00:00:00.000Z",
      }),
      sweater({
        id: "custom",
        owner: "member-b",
        audience: "baby",
        size: "6 mo",
        length: 11,
        createdAt: "2026-02-03T00:00:00.000Z",
      }),
      sweater({
        id: "adult",
        owner: "member-c",
        audience: "misses",
        size: "40",
        length: 24,
        createdAt: "2026-02-04T00:00:00.000Z",
      }),
      { key: "sleeveless/member-d/index.json", body: "{\"summaries\":[]}" },
      { key: "sleeveless/member-d/broken.json", body: "{not-json" },
    ];
    const writes: string[] = [];
    const store = {
      async list() {
        return { blobs: files.map((file) => ({ key: file.key })) };
      },
      async get(key: string) {
        return files.find((file) => file.key === key)?.body ?? null;
      },
      async set(key: string) {
        writes.push(key);
      },
    };

    const report = await scanPatternErrataImpact(errata, store as PatternErrataImpactStore);

    expect(writes).toEqual([]);
    expect(report.readOnly).toBe(true);
    expect(report.scanned).toBe(5);
    expect(report.potentiallyAffected).toMatchObject({ patternCount: 2, ownerCount: 1 });
    expect(report.customized).toMatchObject({ patternCount: 1, ownerCount: 1 });
    expect(report.uncertain.patternCount).toBe(1);
    expect(report.outOfScope).toBe(1);
    expect(report.rows.map((row) => row.classification).sort()).toEqual([
      "customized",
      "old_default",
      "old_default",
      "uncertain",
    ]);
    expect(report.rows.some((row) => row.projectId === "adult")).toBe(false);
  });
});
