import { describe, expect, it } from "vitest";
import {
  aggregateTipReactionRecords,
  tipReactionDisplayRows,
} from "./reactionsAggregate";

describe("tip reaction aggregation", () => {
  it("aggregates totals by tip without exposing visitor ids", () => {
    const totals = aggregateTipReactionRecords("taming-the-curl-2026-08", [
      { reaction: "helped", visitorId: "secret-visitor" },
      { reaction: "helped" },
      { reaction: "not_for_me" },
      { reaction: "will_try" },
      { reaction: "more_like_this" },
      { reaction: "nope" },
    ], [
      {
        topicSuggestion: "Ribbing",
        topicSubmittedAt: "2026-08-02T00:00:00.000Z",
        visitorId: "secret-visitor",
        memberId: "mem_secret",
      },
      {
        topicSuggestion: "  Button bands  ",
        topicSubmittedAt: "2026-08-04T00:00:00.000Z",
      },
      { topicSuggestion: "   " },
    ]);

    expect(totals.tipId).toBe("taming-the-curl-2026-08");
    expect(totals.byReaction.helped).toBe(2);
    expect(totals.byReaction.not_for_me).toBe(1);
    expect(totals.byReaction.will_try).toBe(1);
    expect(totals.byReaction.more_like_this).toBe(1);
    expect(totals.total).toBe(5);
    expect(totals.topicCount).toBe(2);
    expect(totals.topicSuggestions).toEqual(["Button bands", "Ribbing"]);

    const json = JSON.stringify(totals);
    expect(json).not.toContain("visitor");
    expect(json).not.toMatch(/visitorId/i);
    expect(json).not.toContain("secret-visitor");
    expect(json).not.toContain("mem_secret");

    const rows = tipReactionDisplayRows(totals);
    expect(rows.find((r) => r.id === "helped")?.label).toBe("Helpful");
    expect(rows.find((r) => r.id === "not_for_me")?.label).toBe("Not for me");
    expect(rows.find((r) => r.id === "will_try")?.label).toContain("🙂");
    expect(rows.find((r) => r.id === "will_try")?.label).not.toContain("🧶");
    expect(rows.map((r) => r.id)).toEqual([
      "helped",
      "not_for_me",
      "will_try",
      "more_like_this",
    ]);
  });
});
