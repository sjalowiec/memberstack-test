import { describe, expect, it } from "vitest";
import {
  isLegacyCourseDraft,
  isLegacyCoursePublic,
} from "./legacyCoursePublication";

describe("isLegacyCoursePublic", () => {
  it("treats missing status/published as public for hand-cleaned courses", () => {
    expect(isLegacyCoursePublic({})).toBe(true);
    expect(isLegacyCoursePublic({ title: "LK-150 Quick Start" })).toBe(true);
  });

  it("hides explicit draft status", () => {
    expect(isLegacyCoursePublic({ status: "draft" })).toBe(false);
  });

  it("hides published: false", () => {
    expect(isLegacyCoursePublic({ published: false })).toBe(false);
  });

  it("shows explicit published status", () => {
    expect(isLegacyCoursePublic({ status: "published" })).toBe(true);
    expect(isLegacyCoursePublic({ published: true })).toBe(true);
  });

  it("draft status wins over published: true", () => {
    expect(isLegacyCoursePublic({ status: "draft", published: true })).toBe(false);
  });
});

describe("isLegacyCourseDraft", () => {
  it("marks migrated draft courses as draft", () => {
    expect(isLegacyCourseDraft({ status: "draft", published: false })).toBe(true);
  });

  it("does not mark hand-cleaned courses without flags as draft", () => {
    expect(isLegacyCourseDraft({})).toBe(false);
  });
});
