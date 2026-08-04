import { describe, expect, it } from "vitest";
import {
  aggregateTipReactionRecords,
  tipReactionDisplayRows,
} from "./reactionsAggregate";

describe("tip reaction aggregation", () => {
  it("aggregates totals by tip without exposing visitor ids", () => {
    const totals = aggregateTipReactionRecords("taming-the-curl-2026-08", [
      { reaction: "helped" },
      { reaction: "helped" },
      { reaction: "will_try" },
      { reaction: "more_like_this" },
      { reaction: "nope" },
    ]);

    expect(totals.tipId).toBe("taming-the-curl-2026-08");
    expect(totals.byReaction.helped).toBe(2);
    expect(totals.byReaction.will_try).toBe(1);
    expect(totals.byReaction.more_like_this).toBe(1);
    expect(totals.total).toBe(4);

    const json = JSON.stringify(totals);
    expect(json).not.toContain("visitor");
    expect(json).not.toMatch(/visitorId/i);

    const rows = tipReactionDisplayRows(totals);
    expect(rows.find((r) => r.id === "will_try")?.label).toContain("🙂");
    expect(rows.find((r) => r.id === "will_try")?.label).not.toContain("🧶");
  });
});
