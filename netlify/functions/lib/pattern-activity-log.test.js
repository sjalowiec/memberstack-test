import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// In-memory blob store shared across handler calls within a test.
vi.mock("@netlify/blobs", () => {
  const store = new Map();
  return {
    getStore: () => ({
      async set(key, value) {
        store.set(key, value);
      },
      async get(key) {
        return store.has(key) ? store.get(key) : null;
      },
      async list({ prefix } = {}) {
        const blobs = [...store.keys()]
          .filter((key) => !prefix || key.startsWith(prefix))
          .map((key) => ({ key }));
        return { blobs };
      },
    }),
    __activityTestStore: store,
  };
});

import handler from "./pattern-activity-log.js";
import * as blobs from "@netlify/blobs";

const ADMIN_ID = "mem_admin";
const ADMIN_EMAIL = "admin@knitbymachine.com";
const MEMBER_ID = "mem_regular";

const ENV_KEYS = [
  "NODE_ENV",
  "CONTEXT",
  "ALLOW_DEV_PATTERN_USER",
  "PATTERN_ACTIVITY_ADMIN_MEMBER_IDS",
  "PATTERN_ACTIVITY_ADMIN_EMAILS",
];

let savedEnv = {};

function makeReq(method, { memberId, email, body, query } = {}) {
  const headers = {};
  if (memberId) headers["x-kbm-member-id"] = memberId;
  if (email) headers["x-kbm-member-email"] = email;
  if (body) headers["content-type"] = "application/json";
  const url = `https://site.test/.netlify/functions/pattern-activity-log${query ? `?${query}` : ""}`;
  return new Request(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  blobs.__activityTestStore.clear();
  savedEnv = {};
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  // Production-like: disables the local-dev admin bypass so the allowlist is exercised.
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

describe("pattern-activity-log GET (admin-only reporting)", () => {
  it("denies a regular logged-in member with 403", async () => {
    const res = await handler(makeReq("GET", { memberId: MEMBER_ID }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("allows an admin (member id allowlist) and returns events", async () => {
    process.env.PATTERN_ACTIVITY_ADMIN_MEMBER_IDS = `${ADMIN_ID}, mem_other`;

    // Seed one event as a regular member.
    await handler(
      makeReq("POST", {
        memberId: MEMBER_ID,
        body: { eventType: "pattern_saved", patternSystem: "sleeveless" },
      }),
    );

    const res = await handler(makeReq("GET", { memberId: ADMIN_ID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.events)).toBe(true);
    expect(body.events.length).toBe(1);
    expect(body.events[0].eventType).toBe("pattern_saved");
  });

  it("allows an admin via the email allowlist", async () => {
    process.env.PATTERN_ACTIVITY_ADMIN_EMAILS = ADMIN_EMAIL;
    const res = await handler(
      makeReq("GET", { memberId: "mem_someone", email: ADMIN_EMAIL }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("denies a member whose email is not in the allowlist", async () => {
    process.env.PATTERN_ACTIVITY_ADMIN_EMAILS = ADMIN_EMAIL;
    const res = await handler(
      makeReq("GET", { memberId: MEMBER_ID, email: "someone@example.com" }),
    );
    expect(res.status).toBe(403);
  });

  it("requires sign-in (401) when no member id is present", async () => {
    const res = await handler(makeReq("GET", {}));
    expect(res.status).toBe(401);
  });
});

describe("pattern-activity-log POST (logging for any member)", () => {
  it("records an event for a regular logged-in member", async () => {
    const res = await handler(
      makeReq("POST", {
        memberId: MEMBER_ID,
        body: {
          eventType: "pattern_generated",
          patternSystem: "sleeveless",
          patternTitle: "My Tank",
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.event.userId).toBe(MEMBER_ID);
    expect(body.event.eventType).toBe("pattern_generated");
  });

  it("rejects an unknown event type with 400", async () => {
    const res = await handler(
      makeReq("POST", {
        memberId: MEMBER_ID,
        body: { eventType: "pattern_exploded", patternSystem: "sleeveless" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("requires sign-in (401) when no member id is present", async () => {
    const res = await handler(
      makeReq("POST", {
        body: { eventType: "pattern_saved", patternSystem: "sleeveless" },
      }),
    );
    expect(res.status).toBe(401);
  });
});
