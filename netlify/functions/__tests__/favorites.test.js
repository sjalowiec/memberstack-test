import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeData = new Map();
let failWrites = false;

vi.mock("../lib/member-auth.js", () => ({
  requireMember: vi.fn(),
}));

vi.mock("../lib/member-favorites-store.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getFavoritesStore: () => ({
      async get(key, opts) {
        if (!storeData.has(key)) return null;
        return opts?.type === "json" ? storeData.get(key) : storeData.get(key);
      },
      async setJSON(key, value) {
        if (failWrites) throw new Error("blob write failed");
        storeData.set(key, value);
      },
    }),
  };
});

import handler from "../favorites.js";
import { requireMember } from "../lib/member-auth.js";
import { favoritesBlobKey } from "../lib/member-favorites-store.js";

const MEMBER_A = "mem_a";
const MEMBER_B = "mem_b";

function makeRequest(method, { token, url, body } = {}) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return new Request(url || "https://example.com/.netlify/functions/favorites?content_type=video", {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  storeData.clear();
  failWrites = false;
  vi.mocked(requireMember).mockResolvedValue({
    ok: true,
    member: { id: MEMBER_A, email: "a@example.com" },
    mode: "verified",
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("favorites Netlify function", () => {
  it("rejects unauthenticated requests", async () => {
    vi.mocked(requireMember).mockResolvedValue({
      ok: false,
      status: 401,
      error: "Sign in required.",
    });
    const res = await handler(makeRequest("GET"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("rejects invalid content_type on list", async () => {
    const res = await handler(
      makeRequest("GET", {
        url: "https://example.com/.netlify/functions/favorites?content_type=stitches",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/content_type/i);
  });

  it("rejects missing content_id on add", async () => {
    const res = await handler(
      makeRequest("POST", { body: { content_type: "video", content_id: "" } }),
    );
    expect(res.status).toBe(400);
  });

  it("lists only the requested content type for the verified member", async () => {
    storeData.set(favoritesBlobKey(MEMBER_A, "video"), {
      version: 1,
      favorites: [
        {
          id: "f1",
          member_id: MEMBER_A,
          content_type: "video",
          content_id: "10",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const res = await handler(makeRequest("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.content_type).toBe("video");
    expect(body.favorites).toHaveLength(1);
    expect(body.favorites[0].content_id).toBe("10");
  });

  it("ignores browser-supplied member_id in the body", async () => {
    const res = await handler(
      makeRequest("POST", {
        body: {
          content_type: "video",
          content_id: "55",
          member_id: MEMBER_B,
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.favorite.member_id).toBe(MEMBER_A);
    expect(storeData.has(favoritesBlobKey(MEMBER_A, "video"))).toBe(true);
    expect(storeData.has(favoritesBlobKey(MEMBER_B, "video"))).toBe(false);
  });

  it("one member cannot read another member's blob via the API", async () => {
    storeData.set(favoritesBlobKey(MEMBER_B, "video"), {
      version: 1,
      favorites: [
        {
          id: "secret",
          member_id: MEMBER_B,
          content_type: "video",
          content_id: "99",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const res = await handler(makeRequest("GET"));
    const body = await res.json();
    expect(body.favorites).toEqual([]);
  });

  it("returns a controlled error when blob write fails", async () => {
    failWrites = true;
    const res = await handler(
      makeRequest("POST", { body: { content_type: "video", content_id: "1" } }),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/failed/i);
  });
});
