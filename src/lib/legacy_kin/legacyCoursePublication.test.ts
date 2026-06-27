import { describe, expect, it } from "vitest";
import {
  isLegacyCourseActive,
  isLegacyCourseDraft,
  isLegacyCoursePublic,
  readLegacyCoursePublished,
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

  it("hides inactive courses from public routes", () => {
    expect(isLegacyCoursePublic({ active: false, status: "published", published: true })).toBe(
      false,
    );
  });
});

describe("isLegacyCourseActive", () => {
  it("treats missing active as active", () => {
    expect(isLegacyCourseActive({})).toBe(true);
  });

  it("treats active: false as inactive", () => {
    expect(isLegacyCourseActive({ active: false })).toBe(false);
  });
});

describe("isLegacyCourseDraft", () => {
  it("marks migrated draft courses as draft", () => {
    expect(isLegacyCourseDraft({ status: "draft", published: false })).toBe(true);
  });

  it("does not mark inactive published courses as draft", () => {
    expect(isLegacyCourseDraft({ active: false, status: "published", published: true })).toBe(
      false,
    );
  });

  it("does not mark hand-cleaned courses without flags as draft", () => {
    expect(isLegacyCourseDraft({})).toBe(false);
  });
});

describe("readLegacyCoursePublished", () => {
  it("treats missing status/published as published for hand-cleaned courses", () => {
    expect(readLegacyCoursePublished({})).toBe(true);
  });

  it("reads explicit draft and published flags", () => {
    expect(readLegacyCoursePublished({ status: "draft", published: false })).toBe(false);
    expect(readLegacyCoursePublished({ status: "published", published: true })).toBe(true);
  });

  it("ignores catalog active when reading publication only", () => {
    expect(readLegacyCoursePublished({ active: false, status: "published", published: true })).toBe(
      true,
    );
  });
});
