import { describe, expect, it } from "vitest";
import { buildVideoUsageIndex, formatVideoUsageList } from "./videoUsageIndex";

describe("videoUsageIndex", () => {
  it("indexes lesson videoSlug and help-hub videoId", () => {
    const videos = [
      { content_id: 811, slug: "short-row-refresher", title: "Short Row Refresher" },
    ];
    const lessons = [{ slug: "lesson-a", title: "Lesson A", videoSlug: "short-row-refresher" }];
    const helpHub = [{ slug: "tip-a", question: "Tip A", videoId: "811" }];

    const map = buildVideoUsageIndex(lessons, helpHub, videos);
    const refs = map.get("short-row-refresher");
    expect(refs).toHaveLength(2);
    expect(formatVideoUsageList(refs)).toContain("Lesson: Lesson A");
    expect(formatVideoUsageList(refs)).toContain("Help Hub: Tip A");
  });
});
