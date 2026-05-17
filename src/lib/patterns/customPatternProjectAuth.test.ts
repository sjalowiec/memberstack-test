import { describe, expect, it } from "vitest";
import {
  DEFAULT_DEV_PATTERN_USER_ID,
  getOrCreateDevPatternUserId,
  isDevCustomPatternProjectsEnabled,
} from "./customPatternProjectAuth";

describe("customPatternProjectAuth", () => {
  it("uses a stable default dev pattern user id", () => {
    expect(DEFAULT_DEV_PATTERN_USER_ID).toBe("dev_local_pattern_user");
  });

  it("is enabled in vitest (import.meta.env.DEV)", () => {
    expect(isDevCustomPatternProjectsEnabled()).toBe(true);
  });

  it("getOrCreateDevPatternUserId returns the default without localStorage", () => {
    expect(getOrCreateDevPatternUserId()).toBe(DEFAULT_DEV_PATTERN_USER_ID);
  });
});
