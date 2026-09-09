import { describe, expect, it } from "vitest";
import {
  aggregateSkillBuilderReactionRecords,
  skillBuilderReactionDisplayRows,
  SKILL_BUILDER_REACTION_BLOB_STORE,
  TIP_REACTION_BLOB_STORE_NAME,
} from "./skillBuilderReactionsAggregate";
import { aggregateTipReactionRecords } from "../tipOfTheWeek/reactionsAggregate";

describe("skill builder reaction aggregation", () => {
  it("aggregates totals by Skill Builder without exposing visitor ids", () => {
    const totals = aggregateSkillBuilderReactionRecords("skill-builder-short-rows", [
      { reaction: "did_it", contentType: "skill-builder" },
      { reaction: "did_it", contentType: "skill-builder" },
      { reaction: "will_try", contentType: "skill-builder" },
      { reaction: "need_help", contentType: "skill-builder" },
      { reaction: "helped", contentType: "skill-builder" },
      { reaction: "will_try", contentType: "tip-of-the-week" },
    ]);

    expect(totals.skillBuilderId).toBe("skill-builder-short-rows");
    expect(totals.byReaction.did_it).toBe(2);
    expect(totals.byReaction.will_try).toBe(1);
    expect(totals.byReaction.need_help).toBe(1);
    expect(totals.total).toBe(4);

    const json = JSON.stringify(totals);
    expect(json).not.toContain("visitor");
    expect(json).not.toMatch(/visitorId/i);
    expect(json).not.toContain("helped");

    const rows = skillBuilderReactionDisplayRows(totals);
    expect(rows.find((r) => r.id === "need_help")?.label).toContain("I need more help");
    expect(rows.find((r) => r.id === "did_it")?.count).toBe(2);
  });

  it("does not mix Tip of the Week reaction ids into Skill Builder totals", () => {
    const tipTotals = aggregateTipReactionRecords("taming-the-curl-2026-08", [
      { reaction: "helped" },
      { reaction: "will_try" },
    ]);
    const sbTotals = aggregateSkillBuilderReactionRecords("skill-builder-short-rows", [
      { reaction: "did_it", contentType: "skill-builder" },
      { reaction: "will_try", contentType: "skill-builder" },
    ]);

    expect(SKILL_BUILDER_REACTION_BLOB_STORE).not.toBe(TIP_REACTION_BLOB_STORE_NAME);
    expect(tipTotals.byReaction).toHaveProperty("helped");
    expect(tipTotals.byReaction).not.toHaveProperty("did_it");
    expect(sbTotals.byReaction).toHaveProperty("did_it");
    expect(sbTotals.byReaction).not.toHaveProperty("helped");
    expect(tipTotals.byReaction.will_try).toBe(1);
    expect(sbTotals.byReaction.will_try).toBe(1);
  });
});
