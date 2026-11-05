import { describe, expect, it } from "vitest";
import type { TipOfTheWeekRecord, TipOfTheWeekStatus } from "../tipOfTheWeek/types";
import {
  countUniqueVideoFavorites,
  favoriteCountForVideo,
  formatVideoAdminTipDate,
  orderVideoAdminRows,
  summarizeCatalogTipHistory,
  tipSummaryForVideo,
  videoAdminDataNotes,
  videoAdminTipLines,
  type VideoAdminSortable,
} from "./videoAdminPlanning";
import { loadVideoFavoriteDocuments } from "./videoFavoriteCounts";

const TODAY = "2026-11-05";

function tip(
  partial: Partial<TipOfTheWeekRecord> & Pick<TipOfTheWeekRecord, "id" | "status" | "videoContentId">,
): TipOfTheWeekRecord {
  return {
    tipId: partial.id,
    title: partial.title ?? partial.id,
    intro: "",
    introGlossarySlug: "",
    availableFrom: partial.availableFrom ?? "",
    availableThrough: partial.availableThrough ?? "",
    availabilityNotice: "",
    availabilityFooterTemplate: "",
    tryCopy: "",
    sueTipCopy: "",
    ctaText: "",
    ctaUrl: "",
    learnPoints: [],
    relatedLinks: [],
    eyebrow: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function row(partial: Partial<VideoAdminSortable> & Pick<VideoAdminSortable, "kinId">): VideoAdminSortable {
  return {
    title: partial.kinId,
    status: "Published",
    access: "member",
    vimeoId: "",
    favoriteCount: 0,
    tipSortDate: "",
    stableKey: partial.kinId,
    ...partial,
  };
}

describe("video admin tip history", () => {
  const catalog = ["339", "707", "249", "249-1", "880"];

  it("formats never used, one use, repeats, and a separate upcoming date", () => {
    expect(formatVideoAdminTipDate("2026-10-15")).toBe("Oct 15, 2026");
    expect(formatVideoAdminTipDate("2026-08-06")).toBe("Aug 6, 2026");
    expect(videoAdminTipLines({ publicCount: 0, latestStart: null, upcomingStart: null })).toEqual([
      "Never used",
    ]);
    expect(
      videoAdminTipLines({ publicCount: 1, latestStart: "2026-08-06", upcomingStart: null }),
    ).toEqual(["Used once · Last: Aug 6, 2026"]);
    expect(
      videoAdminTipLines({
        publicCount: 3,
        latestStart: "2026-10-15",
        upcomingStart: "2026-11-12",
      }),
    ).toEqual(["Used 3 times · Last: Oct 15, 2026", "Scheduled: Nov 12, 2026"]);
  });

  it("counts published, current, and past runs, and keeps a future date separate", () => {
    const summary = summarizeCatalogTipHistory(
      catalog,
      [
        tip({
          id: "old",
          status: "archived" as TipOfTheWeekStatus,
          videoContentId: "0339",
          availableFrom: "2026-06-01",
          availableThrough: "2026-06-07",
        }),
        tip({
          id: "mid",
          status: "scheduled",
          videoContentId: "339",
          availableFrom: "2026-08-06",
          availableThrough: "2026-08-12",
        }),
        tip({
          id: "live",
          status: "active",
          videoContentId: "339",
          availableFrom: "2026-11-01",
          availableThrough: "2026-11-07",
        }),
        tip({
          id: "next",
          status: "scheduled",
          videoContentId: "339",
          availableFrom: "2026-11-12",
          availableThrough: "2026-11-18",
        }),
        tip({
          id: "draft",
          status: "draft",
          videoContentId: "339",
          availableFrom: "2026-10-01",
          availableThrough: "2026-10-07",
        }),
      ],
      TODAY,
    );
    expect(summary.byVideo["339"]).toEqual({
      publicCount: 3,
      latestStart: "2026-11-01",
      upcomingStart: "2026-11-12",
    });
    expect(summary.byVideo["707"]).toBeUndefined();
    expect(summary.unmatchedIds).toEqual([]);
  });

  it("does not match a nonnumeric KIN id to a nearby number, a slug, or a Vimeo id", () => {
    const summary = summarizeCatalogTipHistory(
      catalog,
      [
        tip({
          id: "clip",
          status: "scheduled",
          videoContentId: "249-1",
          availableFrom: "2026-05-01",
          availableThrough: "2026-05-07",
        }),
        tip({
          id: "slug",
          status: "scheduled",
          videoContentId: "cut-and-sew-cutting",
          availableFrom: "2026-04-01",
          availableThrough: "2026-04-07",
        }),
        tip({
          id: "vimeo",
          status: "scheduled",
          videoContentId: "151859846",
          availableFrom: "2026-03-01",
          availableThrough: "2026-03-07",
        }),
      ],
      TODAY,
    );
    expect(summary.byVideo["249-1"]?.publicCount).toBe(1);
    expect(summary.byVideo["249"]).toBeUndefined();
    expect(summary.unmatchedIds).toEqual(["151859846", "cut-and-sew-cutting"]);
  });
});

describe("video admin favorite counts", () => {
  const catalog = catalogIds();

  it("counts unique members, ignores duplicate rows, and shows no identities", () => {
    const counted = countUniqueVideoFavorites(
      [
        { memberId: "mem_a", contentIds: ["707", "707", "0339"] },
        { memberId: "mem_a", contentIds: ["339"] },
        { memberId: "mem_b", contentIds: ["707", "249-1"] },
        { memberId: "mem_c", contentIds: ["cut-and-sew-cutting"] },
      ],
      catalog,
    );
    expect(counted.counts["707"]).toBe(2);
    expect(counted.counts["339"]).toBe(1);
    expect(counted.counts["249-1"]).toBe(1);
    expect(counted.counts["249"]).toBeUndefined();
    expect(counted.unmatchedIds).toEqual(["cut-and-sew-cutting"]);
    expect(JSON.stringify(counted)).not.toContain("mem_");
  });

  it("returns zero for a catalog video with no favorites when the source loaded", () => {
    const source = {
      ok: true as const,
      counts: { "707": 2 },
      unmatchedIds: [],
    };
    expect(favoriteCountForVideo(source, 707)).toBe(2);
    expect(favoriteCountForVideo(source, "880")).toBe(0);
    expect(favoriteCountForVideo({ ok: false, error: "Saved favorites could not be read." }, 707)).toBeNull();
  });

  it("fails the whole favorite read when a video blob cannot be read", async () => {
    const store = {
      async list() {
        return { blobs: [{ key: "mem_a/by-type/video.json" }, { key: "mem_b/by-type/stitch.json" }] };
      },
      async get() {
        throw new Error("blob missing");
      },
    };
    const loaded = await loadVideoFavoriteDocuments(store);
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error).toContain("Saved favorites could not be read");
  });

  it("reads only video favorite blobs and drops member ids", async () => {
    const store = {
      async list() {
        return {
          blobs: [
            { key: "mem_a/by-type/video.json" },
            { key: "mem_a/by-type/stitch.json" },
            { key: "mem_b/by-type/video.json" },
          ],
        };
      },
      async get(key: string) {
        if (key.startsWith("mem_a")) {
          return { favorites: [{ content_id: "707" }, { content_id: "707" }, { member_id: "mem_a" }] };
        }
        return { favorites: [{ content_id: "707" }, { content_id: "249-1" }] };
      },
    };
    const loaded = await loadVideoFavoriteDocuments(store);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const counted = countUniqueVideoFavorites(loaded.documents, catalog);
    expect(counted.counts).toEqual({ "707": 2, "249-1": 1 });
    expect(JSON.stringify(counted)).not.toContain("mem_");
  });
});

describe("video admin sorting", () => {
  const rows = [
    row({ kinId: "1000", title: "Zebra", vimeoId: "20", favoriteCount: 2, tipSortDate: "2026-01-01" }),
    row({ kinId: "249-1", title: "alpha clip", status: "Draft", access: "public", vimeoId: "9", favoriteCount: 10, tipSortDate: "2026-10-15" }),
    row({ kinId: "249", title: "Alpha", status: "Published", access: "member", vimeoId: "100", favoriteCount: 0, tipSortDate: "" }),
    row({ kinId: "10", title: "Middle", status: "Archived", access: "Not set", vimeoId: "", favoriteCount: null, tipSortDate: null }),
    row({ kinId: "2", title: "Beta", vimeoId: "3", favoriteCount: 2, tipSortDate: "2026-08-06" }),
  ];

  it("sorts KIN ids and Vimeo ids numerically, including 249-1", () => {
    expect(orderVideoAdminRows(rows, "kinId", "asc").map((item) => item.kinId)).toEqual([
      "2",
      "10",
      "249",
      "249-1",
      "1000",
    ]);
    expect(orderVideoAdminRows(rows, "vimeoId", "asc").map((item) => item.vimeoId)).toEqual([
      "",
      "3",
      "9",
      "20",
      "100",
    ]);
  });

  it("sorts title, status, and access as text, and favorite counts as numbers", () => {
    expect(orderVideoAdminRows(rows, "title", "asc").map((item) => item.title)).toEqual([
      "Alpha",
      "alpha clip",
      "Beta",
      "Middle",
      "Zebra",
    ]);
    expect(orderVideoAdminRows(rows, "status", "asc").map((item) => item.status)).toEqual([
      "Archived",
      "Draft",
      "Published",
      "Published",
      "Published",
    ]);
    expect(orderVideoAdminRows(rows, "favorites", "desc").map((item) => item.favoriteCount)).toEqual([
      10,
      2,
      2,
      0,
      null,
    ]);
  });

  it("sorts Tip of the Week by the last featured date and groups never-used videos", () => {
    const asc = orderVideoAdminRows(rows, "tip", "asc").map((item) => item.kinId);
    expect(asc.slice(0, 4)).toEqual(["249", "1000", "2", "249-1"]);
    expect(asc[4]).toBe("10");
    const desc = orderVideoAdminRows(rows, "tip", "desc").map((item) => item.kinId);
    expect(desc.slice(0, 4)).toEqual(["249-1", "2", "1000", "249"]);
    expect(desc[4]).toBe("10");
  });

  it("sorts the complete filtered set, not a page of it", () => {
    const filtered = rows.filter((item) => item.kinId === "249" || item.kinId === "249-1" || item.kinId === "2");
    expect(orderVideoAdminRows(filtered, "favorites", "asc").map((item) => item.kinId)).toEqual([
      "249",
      "2",
      "249-1",
    ]);
  });
});

describe("video admin data gaps", () => {
  it("reports an unavailable source instead of a zero count", () => {
    const notes = videoAdminDataNotes({
      favorites: { ok: false, error: "Saved favorites could not be read, so counts are not shown." },
      tips: { ok: false, error: "Tip of the Week records could not be loaded, so history is not shown." },
    });
    expect(notes.join(" ")).toContain("favorites");
    expect(notes.join(" ")).toContain("Tip of the Week");
    expect(notes.join(" ")).not.toContain("0");
    expect(tipSummaryForVideo({ ok: false, error: "down" }, "707")).toBeNull();
  });

  it("names unmatched ids without turning them into a catalog match", () => {
    const notes = videoAdminDataNotes({
      favorites: { ok: true, counts: {}, unmatchedIds: ["cut-and-sew-cutting"] },
      tips: { ok: true, byVideo: {}, unmatchedIds: ["151859846"] },
    });
    expect(notes[0]).toContain("cut-and-sew-cutting");
    expect(notes[1]).toContain("151859846");
  });
});

function catalogIds(): Set<string> {
  return new Set(["339", "707", "249", "249-1", "880"]);
}
