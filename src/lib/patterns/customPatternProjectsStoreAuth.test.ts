import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_DEV_PATTERN_USER_ID,
  isAllowDevPatternUser,
  resolveDevPatternUserId,
  resolveProjectUserId,
} from "../../../netlify/functions/lib/custom-pattern-projects-store.js";

function mockRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/.netlify/functions/custom-pattern-project-save", {
    headers,
  });
}

describe("resolveProjectUserId (Netlify store)", () => {
  const prevAllow = process.env.ALLOW_DEV_PATTERN_USER;
  const prevNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.ALLOW_DEV_PATTERN_USER = "false";
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    if (prevAllow === undefined) delete process.env.ALLOW_DEV_PATTERN_USER;
    else process.env.ALLOW_DEV_PATTERN_USER = prevAllow;
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
  });

  it("requires sign-in when dev saves are disabled", () => {
    const result = resolveProjectUserId(mockRequest());
    expect(result).toMatchObject({ error: expect.any(String), status: 401 });
  });

  it("uses member id when present", () => {
    process.env.ALLOW_DEV_PATTERN_USER = "true";
    const result = resolveProjectUserId(
      mockRequest({ "X-KBM-Member-Id": "ms_member_1" }),
    );
    expect(result).toEqual({ userId: "ms_member_1", mode: "member" });
  });

  it("uses dev fallback without headers when ALLOW_DEV_PATTERN_USER is true", () => {
    process.env.ALLOW_DEV_PATTERN_USER = "true";
    const result = resolveProjectUserId(mockRequest());
    expect(result).toEqual({ userId: DEFAULT_DEV_PATTERN_USER_ID, mode: "dev" });
  });

  it("prefers X-KBM-Dev-User-Id over default when provided", () => {
    process.env.ALLOW_DEV_PATTERN_USER = "true";
    const result = resolveProjectUserId(
      mockRequest({ "X-KBM-Dev-User-Id": "dev_browser_abc" }),
    );
    expect(result).toEqual({ userId: "dev_browser_abc", mode: "dev" });
  });
});

describe("isAllowDevPatternUser", () => {
  const prevAllow = process.env.ALLOW_DEV_PATTERN_USER;
  const prevNodeEnv = process.env.NODE_ENV;
  const prevContext = process.env.CONTEXT;

  afterEach(() => {
    if (prevAllow === undefined) delete process.env.ALLOW_DEV_PATTERN_USER;
    else process.env.ALLOW_DEV_PATTERN_USER = prevAllow;
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
    if (prevContext === undefined) delete process.env.CONTEXT;
    else process.env.CONTEXT = prevContext;
  });

  it("is true when ALLOW_DEV_PATTERN_USER=true", () => {
    process.env.ALLOW_DEV_PATTERN_USER = "true";
    expect(isAllowDevPatternUser()).toBe(true);
  });

  it("is false when explicitly disabled", () => {
    process.env.ALLOW_DEV_PATTERN_USER = "false";
    expect(isAllowDevPatternUser()).toBe(false);
  });

  it("is false in production even when ALLOW_DEV_PATTERN_USER=true", () => {
    process.env.NODE_ENV = "production";
    process.env.CONTEXT = "production";
    process.env.ALLOW_DEV_PATTERN_USER = "true";
    expect(isAllowDevPatternUser()).toBe(false);
  });
});

describe("resolveDevPatternUserId", () => {
  it("returns default when no header", () => {
    expect(resolveDevPatternUserId(mockRequest())).toBe(DEFAULT_DEV_PATTERN_USER_ID);
  });
});
