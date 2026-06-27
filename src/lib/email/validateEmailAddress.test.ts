import { describe, expect, it } from "vitest";
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from "./validateEmailAddress";

describe("validateEmailAddress", () => {
  it("trims whitespace before validation", () => {
    expect(normalizeEmailAddress("  sue@example.com  ")).toBe("sue@example.com");
    expect(isValidEmailAddress("  sue@example.com  ".trim())).toBe(true);
  });

  it("rejects invalid email addresses", () => {
    expect(isValidEmailAddress("")).toBe(false);
    expect(isValidEmailAddress("not-an-email")).toBe(false);
    expect(isValidEmailAddress("missing@domain")).toBe(false);
    expect(isValidEmailAddress("@example.com")).toBe(false);
  });

  it("accepts a typical valid email", () => {
    expect(isValidEmailAddress("customer@knititnow.com")).toBe(true);
  });
});
