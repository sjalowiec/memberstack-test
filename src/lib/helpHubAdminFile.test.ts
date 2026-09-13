import { describe, expect, it } from "vitest";
import { mergeHelpHubPutUpdate } from "./helpHubAdminFile";

describe("mergeHelpHubPutUpdate", () => {
  it("preserves relatedLessons when omitted from a status-only PUT", () => {
    const existing = {
      id: 1006,
      title: "Changing Colors on the LK150",
      slug: "change-colors-lk150",
      category: "color-texture",
      status: "published",
      question: "How do I change colors on my LK150?",
      mediaType: "video",
      mediaUrl: "change-colors-lk150",
      relatedLessons: ["colorwork-first-steps"],
    };

    const body = {
      title: existing.title,
      slug: existing.slug,
      category: existing.category,
      status: "draft",
    };

    const merged = mergeHelpHubPutUpdate(existing, body, {
      id: 1006,
      title: body.title,
      slug: body.slug,
      category: body.category,
      status: body.status,
    });

    expect(merged.status).toBe("draft");
    expect(merged.relatedLessons).toEqual(["colorwork-first-steps"]);
    expect(merged.mediaUrl).toBe("change-colors-lk150");
    expect(merged.question).toBe(existing.question);
  });

  it("clears relatedLessons when explicitly sent as an empty array", () => {
    const existing = {
      id: 1006,
      title: "Changing Colors on the LK150",
      slug: "change-colors-lk150",
      category: "color-texture",
      status: "published",
      relatedLessons: ["colorwork-first-steps"],
    };

    const merged = mergeHelpHubPutUpdate(
      existing,
      {
        title: existing.title,
        slug: existing.slug,
        category: existing.category,
        status: existing.status,
        relatedLessons: [],
      },
      {
        id: 1006,
        title: existing.title,
        slug: existing.slug,
        category: existing.category,
        status: existing.status,
      }
    );

    expect(merged.relatedLessons).toEqual([]);
  });

  it("keeps numeric relatedLessons as numbers", () => {
    const existing = {
      id: 1008,
      title: "Where can I find patterns for my LK150?",
      slug: "patterns-for-lk150",
      category: "pattern-design-confusion",
      status: "draft",
      relatedLessons: [259, 368],
    };

    const merged = mergeHelpHubPutUpdate(
      existing,
      {
        title: existing.title,
        slug: existing.slug,
        category: existing.category,
        status: existing.status,
        relatedLessons: [259, "368"],
      },
      {
        id: 1008,
        title: existing.title,
        slug: existing.slug,
        category: existing.category,
        status: existing.status,
      },
    );

    expect(merged.relatedLessons).toEqual([259, 368]);
  });
});
