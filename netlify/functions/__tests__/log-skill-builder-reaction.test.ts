import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeData = new Map();

vi.mock("@netlify/blobs", () => ({
  getStore: ({ name }) => {
    if (name !== "skill-builder-reactions") {
      throw new Error(`Unexpected blob store: ${name}`);
    }
    return {
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
    };
  },
}));

import handler from "../log-skill-builder-reaction";

function makeRequest(method, { body, url } = {}) {
  return new Request(
    url || "https://example.com/.netlify/functions/log-skill-builder-reaction",
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    },
  );
}

describe("log-skill-builder-reaction", () => {
  beforeEach(() => {
    storeData.clear();
    vi.stubEnv("ALLOW_DEV_PATTERN_USER", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects unknown reactions including Tip of the Week-only ids", async () => {
    const unknown = await handler(
      makeRequest("POST", {
        body: { skillBuilderId: "skill-builder-short-rows", reaction: "nope", visitorId: "v1" },
      }),
    );
    expect(unknown.status).toBe(400);

    const tipOnly = await handler(
      makeRequest("POST", {
        body: { skillBuilderId: "skill-builder-short-rows", reaction: "helped", visitorId: "v1" },
      }),
    );
    expect(tipOnly.status).toBe(400);
    expect(storeData.size).toBe(0);
  });

  it("upserts one record per Skill Builder + visitor instead of appending duplicates", async () => {
    const first = await handler(
      makeRequest("POST", {
        body: {
          skillBuilderId: "skill-builder-short-rows",
          reaction: "did_it",
          visitorId: "visitor-1",
          memberId: "mem_abc",
          createdAt: "2026-09-09T12:00:00.000Z",
        },
      }),
    );
    expect(first.status).toBe(200);

    const second = await handler(
      makeRequest("POST", {
        body: {
          skillBuilderId: "skill-builder-short-rows",
          reaction: "need_help",
          visitorId: "visitor-1",
          memberId: "mem_abc",
        },
      }),
    );
    expect(second.status).toBe(200);

    expect(storeData.size).toBe(1);
    const stored = JSON.parse([...storeData.values()][0]);
    expect(stored.reaction).toBe("need_help");
    expect(stored.visitorId).toBe("visitor-1");
    expect(stored.memberId).toBe("mem_abc");
    expect(stored.contentType).toBe("skill-builder");
    expect(stored.createdAt).toBe("2026-09-09T12:00:00.000Z");
    expect(stored.updatedAt).toBeTruthy();
  });

  it("keeps separate Skill Builders distinct for the same visitor", async () => {
    await handler(
      makeRequest("POST", {
        body: { skillBuilderId: "skill-builder-short-rows", reaction: "did_it", visitorId: "v1" },
      }),
    );
    await handler(
      makeRequest("POST", {
        body: {
          skillBuilderId: "skill-builder-e-wrap-cast-on",
          reaction: "will_try",
          visitorId: "v1",
        },
      }),
    );
    expect(storeData.size).toBe(2);
  });

  it("blocks GET listing outside local dev and does not email or alert", async () => {
    vi.stubEnv("ALLOW_DEV_PATTERN_USER", "false");
    const res = await handler(makeRequest("GET"));
    expect(res.status).toBe(403);
    const source = (await import("node:fs")).readFileSync(
      new URL("../log-skill-builder-reaction.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain("nodemailer");
    expect(source).not.toContain("mailto:");
    expect(source).not.toContain("/.netlify/functions/contact");
    expect(source).not.toContain("sendgrid");
  });
});
