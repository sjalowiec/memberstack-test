import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  activityEventKey,
  ACTIVITY_EVENT_PREFIX,
  isActivityAdmin,
  normalizeActivityEvent,
} from "./pattern-activity-store.js";

describe("normalizeActivityEvent", () => {
  it("normalizes an event with required fields and authoritative userId", () => {
    const result = normalizeActivityEvent(
      {
        userId: "client-claimed-id",
        eventType: "pattern_saved",
        patternSystem: "sleeveless",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      "mem_server_authoritative",
    );

    expect(result.ok).toBe(true);
    expect(result.event.userId).toBe("mem_server_authoritative");
    expect(result.event.eventType).toBe("pattern_saved");
    expect(result.event.patternSystem).toBe("sleeveless");
    expect(typeof result.event.id).toBe("string");
  });

  it("keeps small optional metadata", () => {
    const result = normalizeActivityEvent(
      {
        eventType: "pattern_opened",
        patternSystem: "sleeveless",
        metadata: { action: "view" },
      },
      "mem_1",
    );

    expect(result.ok).toBe(true);
    expect(result.event.metadata).toEqual({ action: "view" });
  });

  it("omits missing optional fields", () => {
    const result = normalizeActivityEvent(
      { eventType: "pattern_started", patternSystem: "sleeveless" },
      "mem_1",
    );

    expect(result.ok).toBe(true);
    expect(result.event).not.toHaveProperty("userEmail");
    expect(result.event).not.toHaveProperty("patternId");
    expect(result.event).not.toHaveProperty("patternTitle");
    expect(result.event).not.toHaveProperty("metadata");
  });

  it("rejects unknown event types and missing user id", () => {
    expect(
      normalizeActivityEvent(
        { eventType: "pattern_exploded", patternSystem: "sleeveless" },
        "mem_1",
      ).ok,
    ).toBe(false);
    expect(
      normalizeActivityEvent({ eventType: "pattern_saved", patternSystem: "sleeveless" }, "").ok,
    ).toBe(false);
  });

  it("defaults patternSystem to unknown when absent", () => {
    const result = normalizeActivityEvent({ eventType: "pattern_printed" }, "mem_1");
    expect(result.ok).toBe(true);
    expect(result.event.patternSystem).toBe("unknown");
  });
});

describe("isActivityAdmin", () => {
  const ADMIN_ID = "mem_admin";
  const ADMIN_EMAIL = "admin@knitbymachine.com";
  const ENV_KEYS = [
    "NODE_ENV",
    "CONTEXT",
    "ALLOW_DEV_PATTERN_USER",
    "PATTERN_ACTIVITY_ADMIN_MEMBER_IDS",
    "PATTERN_ACTIVITY_ADMIN_EMAILS",
  ];
  /** @type {Record<string, string | undefined>} */
  let savedEnv = {};

  function makeReq(emailHeader = "") {
    const headers = {};
    if (emailHeader) headers["x-kbm-member-email"] = emailHeader;
    return new Request("https://site.test/.netlify/functions/pattern-activity-log", {
      method: "GET",
      headers,
    });
  }

  beforeEach(() => {
    savedEnv = {};
    for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
    process.env.NODE_ENV = "production";
    process.env.CONTEXT = "production";
    delete process.env.ALLOW_DEV_PATTERN_USER;
    delete process.env.PATTERN_ACTIVITY_ADMIN_MEMBER_IDS;
    delete process.env.PATTERN_ACTIVITY_ADMIN_EMAILS;
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  it("allows an admin by verified member id", () => {
    process.env.PATTERN_ACTIVITY_ADMIN_MEMBER_IDS = ADMIN_ID;
    expect(isActivityAdmin(makeReq(), ADMIN_ID, "someone@example.com")).toBe(true);
  });

  it("allows an admin by verified Memberstack email", () => {
    process.env.PATTERN_ACTIVITY_ADMIN_EMAILS = ADMIN_EMAIL;
    expect(isActivityAdmin(makeReq(), "mem_someone", ADMIN_EMAIL)).toBe(true);
  });

  it("allows by verified email when the client omits X-KBM-Member-Email", () => {
    process.env.PATTERN_ACTIVITY_ADMIN_EMAILS = ADMIN_EMAIL;
    expect(isActivityAdmin(makeReq(), "mem_someone", ADMIN_EMAIL)).toBe(true);
  });

  it("rejects a signed-in non-admin", () => {
    process.env.PATTERN_ACTIVITY_ADMIN_MEMBER_IDS = ADMIN_ID;
    process.env.PATTERN_ACTIVITY_ADMIN_EMAILS = ADMIN_EMAIL;
    expect(isActivityAdmin(makeReq("someone@example.com"), "mem_regular", "someone@example.com")).toBe(
      false,
    );
  });

  it("does not grant access from a spoofed client email when verified identity is not allowlisted", () => {
    process.env.PATTERN_ACTIVITY_ADMIN_EMAILS = ADMIN_EMAIL;
    expect(isActivityAdmin(makeReq(ADMIN_EMAIL), "mem_regular", "someone@example.com")).toBe(false);
  });
});

describe("activityEventKey", () => {
  it("buckets the key by created date and id", () => {
    const key = activityEventKey({ id: "abc", createdAt: "2026-03-04T12:00:00.000Z" });
    expect(key).toBe(`${ACTIVITY_EVENT_PREFIX}2026-03-04/abc.json`);
  });
});
