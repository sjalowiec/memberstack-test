import { describe, expect, it } from "vitest";
import {
  accessLevelSummaryBucket,
  isValidVideoAccessLevel,
  validatePendingAccessLevel,
  videoAccessNeedsReview,
} from "./videoAccessLevel";

describe("videoAccessLevel", () => {
  it("treats public, member, and draft as valid", () => {
    expect(isValidVideoAccessLevel("public")).toBe(true);
    expect(isValidVideoAccessLevel("member")).toBe(true);
    expect(isValidVideoAccessLevel("draft")).toBe(true);
  });

  it("flags legacy open, free, missing, and blank as needs review", () => {
    expect(videoAccessNeedsReview("open")).toBe(true);
    expect(videoAccessNeedsReview("free")).toBe(true);
    expect(videoAccessNeedsReview("")).toBe(true);
    expect(videoAccessNeedsReview(null)).toBe(true);
    expect(videoAccessNeedsReview(undefined)).toBe(true);
  });

  it("does not treat member as needs review", () => {
    expect(videoAccessNeedsReview("member")).toBe(false);
    expect(accessLevelSummaryBucket("member")).toBe("member");
  });

  it("validates pending saves", () => {
    expect(validatePendingAccessLevel("public").ok).toBe(true);
    expect(validatePendingAccessLevel("").ok).toBe(false);
    expect(validatePendingAccessLevel("open").ok).toBe(false);
  });
});
