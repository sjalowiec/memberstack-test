import { describe, expect, it } from "vitest";
import videos from "../../data/videos-public.json";
import { applyVideoPosterOverrides, planVideoPosterSave } from "./videoPosterOverrides";

const catalog = videos as Array<Record<string, unknown>>;

function formLike(source: Record<string, unknown>, posterUrl?: string): Record<string, unknown> {
  const row = { ...source };
  if (posterUrl !== undefined) row.posterUrl = posterUrl;
  const status = String(row.status || "").toLowerCase();
  row.status = status === "draft" || status === "archived" ? status : "published";
  row.tipOfWeek = Boolean(row.tipOfWeek ?? row.isTipOfWeek);
  row.isTipOfWeek = row.tipOfWeek;
  row.search_ready = Boolean(row.search_ready);
  return row;
}

describe("planVideoPosterSave", () => {
  it("stores a refreshed thumbnail without treating the editor defaults as catalog edits", () => {
    const nextPoster = "https://i.vimeocdn.com/video/2214184278-example-d_1280x720?r=pad";
    const submitted = catalog.map((video) =>
      video.content_id === 649 ? formLike(video, nextPoster) : video,
    );

    const plan = planVideoPosterSave(catalog, submitted);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.overrides).toEqual([{ contentId: "649", posterUrl: nextPoster }]);
    expect(plan.message).toContain("Video Library");
    expect(plan.message).toContain("Tip of the Week");
  });

  it("keeps a matching thumbnail out of override storage", () => {
    const submitted = catalog.map((video) => (video.content_id === 649 ? formLike(video) : video));
    const plan = planVideoPosterSave(catalog, submitted);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.overrides).toEqual([]);
    expect(plan.message).toContain("matches the catalog");
  });

  it("rejects a title change so the thumbnail save cannot drop other edits", () => {
    const submitted = catalog.map((video) =>
      video.content_id === 649 ? { ...formLike(video), title: "Changed title" } : video,
    );
    const plan = planVideoPosterSave(catalog, submitted);
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.error).toContain("title");
    expect(plan.error).toContain("649");
    expect(plan.error).toContain("nothing was saved");
  });

  it("rejects a catalog that would add or remove a video", () => {
    const plan = planVideoPosterSave(catalog, catalog.slice(0, -1));
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.error).toContain("add or remove");
  });
});

describe("applyVideoPosterOverrides", () => {
  it("uses the stored thumbnail for a content id and leaves the other videos unchanged", () => {
    const stored = "https://i.vimeocdn.com/video/stored-d_1280x720?r=pad";
    const overrides = new Map([["649", stored]]);
    const applied = applyVideoPosterOverrides(catalog, overrides);
    const video = applied.find((row) => (row as { content_id?: number }).content_id === 649) as {
      posterUrl?: string;
    };
    expect(video.posterUrl).toBe(stored);
    expect(applied.find((row) => (row as { content_id?: number }).content_id === 812)).toBe(
      catalog.find((row) => row.content_id === 812),
    );
  });
});
