import { beforeEach, describe, expect, it } from "vitest";
import {
  addFavorite,
  favoritesBlobKey,
  isFavoriteContentType,
  listFavorites,
  normalizeFavoriteContentId,
  removeFavorite,
} from "./member-favorites-store.js";

function createMemoryStore() {
  /** @type {Map<string, unknown>} */
  const data = new Map();
  return {
    data,
    async get(key, opts) {
      if (!data.has(key)) return null;
      const value = data.get(key);
      if (opts?.type === "json") return value;
      return value;
    },
    async setJSON(key, value) {
      data.set(key, value);
    },
  };
}

describe("member-favorites-store helpers", () => {
  it("normalizes content_id to a string", () => {
    expect(normalizeFavoriteContentId(42)).toBe("42");
    expect(normalizeFavoriteContentId("  abc  ")).toBe("abc");
    expect(normalizeFavoriteContentId("")).toBeNull();
    expect(normalizeFavoriteContentId(null)).toBeNull();
  });

  it("accepts only known content types", () => {
    expect(isFavoriteContentType("video")).toBe(true);
    expect(isFavoriteContentType("help-hub")).toBe(false);
    expect(isFavoriteContentType("")).toBe(false);
  });

  it("builds a per-member per-type blob key", () => {
    expect(favoritesBlobKey("mem_abc", "video")).toBe("mem_abc/by-type/video.json");
  });
});

describe("member favorites CRUD", () => {
  /** @type {ReturnType<typeof createMemoryStore>} */
  let store;

  beforeEach(() => {
    store = createMemoryStore();
  });

  it("adds a favorite", async () => {
    const result = await addFavorite(store, "mem_a", "video", 1001);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(true);
    expect(result.favorite.content_id).toBe("1001");
    expect(result.favorite.content_type).toBe("video");
    expect(result.favorite.member_id).toBe("mem_a");
    expect(result.favorite.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const listed = await listFavorites(store, "mem_a", "video");
    expect(listed).toHaveLength(1);
    expect(listed[0].content_id).toBe("1001");
  });

  it("does not duplicate on add", async () => {
    await addFavorite(store, "mem_a", "video", "1001");
    const second = await addFavorite(store, "mem_a", "video", "1001");
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.created).toBe(false);
    const listed = await listFavorites(store, "mem_a", "video");
    expect(listed).toHaveLength(1);
  });

  it("removes a favorite", async () => {
    await addFavorite(store, "mem_a", "video", "1001");
    const removed = await removeFavorite(store, "mem_a", "video", "1001");
    expect(removed.ok).toBe(true);
    if (removed.ok) expect(removed.removed).toBe(true);
    expect(await listFavorites(store, "mem_a", "video")).toHaveLength(0);
  });

  it("removing a nonexistent favorite is harmless", async () => {
    const removed = await removeFavorite(store, "mem_a", "video", "missing");
    expect(removed.ok).toBe(true);
    if (removed.ok) expect(removed.removed).toBe(false);
  });

  it("rejects missing content_id", async () => {
    const add = await addFavorite(store, "mem_a", "video", "  ");
    expect(add.ok).toBe(false);
    if (!add.ok) expect(add.status).toBe(400);

    const remove = await removeFavorite(store, "mem_a", "video", "");
    expect(remove.ok).toBe(false);
  });

  it("isolates favorites per member", async () => {
    await addFavorite(store, "mem_a", "video", "1");
    await addFavorite(store, "mem_b", "video", "2");

    const a = await listFavorites(store, "mem_a", "video");
    const b = await listFavorites(store, "mem_b", "video");
    expect(a.map((row) => row.content_id)).toEqual(["1"]);
    expect(b.map((row) => row.content_id)).toEqual(["2"]);
    expect(store.data.has(favoritesBlobKey("mem_a", "video"))).toBe(true);
    expect(store.data.has(favoritesBlobKey("mem_b", "video"))).toBe(true);
  });
});
