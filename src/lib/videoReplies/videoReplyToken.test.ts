import { describe, expect, it } from "vitest";

import {
  generateVideoReplyPublicToken,
  isPlausibleVideoReplyPublicToken,
} from "./videoReplyToken";

describe("videoReplyToken", () => {
  it("generates a strong non-guessable token", () => {
    const token = generateVideoReplyPublicToken();
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(isPlausibleVideoReplyPublicToken(token)).toBe(true);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("does not derive tokens from email or sequential ids", () => {
    const a = generateVideoReplyPublicToken();
    const b = generateVideoReplyPublicToken();
    expect(a).not.toBe(b);
    expect(a).not.toContain("@");
    expect(a).not.toMatch(/^\d+$/);
  });

  it("rejects weak or malformed tokens", () => {
    expect(isPlausibleVideoReplyPublicToken("short")).toBe(false);
    expect(isPlausibleVideoReplyPublicToken("email@example.com")).toBe(false);
    expect(isPlausibleVideoReplyPublicToken("has spaces in token value!!")).toBe(false);
    expect(isPlausibleVideoReplyPublicToken(null)).toBe(false);
  });
});
