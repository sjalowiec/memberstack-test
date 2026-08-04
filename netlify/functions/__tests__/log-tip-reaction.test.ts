import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeData = new Map();

vi.mock("@netlify/blobs", () => ({
  getStore: () => ({
    async get(key, opts) {
      if (!storeData.has(key)) return null;
      const value = storeData.get(key);
      return opts?.type === "json" ? JSON.parse(value) : value;
    },
    async set(key, value) {
      storeData.set(key, value);
    },
    async list({ prefix }) {
      const blobs = [...storeData.keys()]
        .filter((k) => String(k).startsWith(prefix || ""))
        .map((key) => ({ key }));
      return { blobs };
    },
  }),
}));

import handler from "../log-tip-reaction";

function makeRequest(method, { body, url } = {}) {
  return new Request(url || "https://example.com/.netlify/functions/log-tip-reaction", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("log-tip-reaction", () => {
  beforeEach(() => {
    storeData.clear();
    vi.stubEnv("ALLOW_DEV_PATTERN_USER", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects unknown reactions", async () => {
    const res = await handler(
      makeRequest("POST", {
        body: { tipId: "tip-a", reaction: "nope", visitorId: "v1" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("upserts one record per tip + visitor instead of appending duplicates", async () => {
    const first = await handler(
      makeRequest("POST", {
        body: {
          tipId: "taming-the-curl-2026-08",
          reaction: "helped",
          visitorId: "visitor-1",
          createdAt: "2026-08-04T12:00:00.000Z",
        },
      }),
    );
    expect(first.status).toBe(200);

    const second = await handler(
      makeRequest("POST", {
        body: {
          tipId: "taming-the-curl-2026-08",
          reaction: "will_try",
          visitorId: "visitor-1",
        },
      }),
    );
    expect(second.status).toBe(200);

    expect(storeData.size).toBe(1);
    const stored = JSON.parse([...storeData.values()][0]);
    expect(stored.reaction).toBe("will_try");
    expect(stored.visitorId).toBe("visitor-1");
    expect(stored.createdAt).toBe("2026-08-04T12:00:00.000Z");
    expect(stored.updatedAt).toBeTruthy();
  });

  it("keeps separate tips distinct for the same visitor", async () => {
    await handler(
      makeRequest("POST", {
        body: { tipId: "tip-a", reaction: "helped", visitorId: "v1" },
      }),
    );
    await handler(
      makeRequest("POST", {
        body: { tipId: "tip-b", reaction: "more_like_this", visitorId: "v1" },
      }),
    );
    expect(storeData.size).toBe(2);
  });

  it("blocks GET listing outside local dev", async () => {
    vi.stubEnv("ALLOW_DEV_PATTERN_USER", "false");
    const res = await handler(makeRequest("GET"));
    expect(res.status).toBe(403);
  });
});
