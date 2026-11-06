import { describe, expect, it, vi } from "vitest";
import {
  catalogPosterUrlFromThumbnail,
  fetchVimeoCatalogPoster,
  posterSyncAction,
  syncSubmittedVideoPosters,
  vimeoOembedPageUrl,
} from "./vimeoCatalogPoster";

const RAW =
  "https://i.vimeocdn.com/video/2214184278-99c863ffbba5df5cf08fab006baa6b775faf5a42fb8aa1b21913900feaea997f-d_960?region=us";
const CATALOG =
  "https://i.vimeocdn.com/video/2214184278-99c863ffbba5df5cf08fab006baa6b775faf5a42fb8aa1b21913900feaea997f-d_1280x720?r=pad";

describe("catalogPosterUrlFromThumbnail", () => {
  it("stores the 1280 poster used by the catalog", () => {
    expect(catalogPosterUrlFromThumbnail(RAW)).toBe(CATALOG);
  });

  it("keeps an address that is already 1280", () => {
    expect(catalogPosterUrlFromThumbnail(CATALOG)).toBe(CATALOG);
  });

  it("rejects a non-Vimeo picture address", () => {
    expect(catalogPosterUrlFromThumbnail("https://example.com/video/1-d_960")).toBeNull();
  });

  it("keeps underscore Vimeo pictures on an underscore address", () => {
    expect(
      catalogPosterUrlFromThumbnail(
        "https://i.vimeocdn.com/video/1270049673-6ae64a8675053d2b51d2897aabbebf71bc9b3e500fe6419eb_960?region=us",
      ),
    ).toBe(
      "https://i.vimeocdn.com/video/1270049673-6ae64a8675053d2b51d2897aabbebf71bc9b3e500fe6419eb_1280x720?r=pad",
    );
    expect(
      catalogPosterUrlFromThumbnail(
        "https://i.vimeocdn.com/video/1282582818-d440541bc3049c11104a9010a5e1576da630212a5fdebdeec_1280?region=us",
      ),
    ).toBe(
      "https://i.vimeocdn.com/video/1282582818-d440541bc3049c11104a9010a5e1576da630212a5fdebdeec_1280x720?r=pad",
    );
  });
});

describe("posterSyncAction", () => {
  const previousPoster = "https://i.vimeocdn.com/video/old-d_1280x720?r=pad";

  it("loads a picture when the save has none", () => {
    expect(
      posterSyncAction({
        previousVimeoId: 151858524,
        nextVimeoId: 151858524,
        previousPoster: "",
        nextPoster: "",
      }),
    ).toBe("load");
  });

  it("loads a picture when the Vimeo ID changed and the old picture was left in place", () => {
    expect(
      posterSyncAction({
        previousVimeoId: 151819909,
        nextVimeoId: 1175910961,
        previousPoster,
        nextPoster: previousPoster,
      }),
    ).toBe("load");
  });

  it("keeps a picture the admin set, including a stale picture for the same Vimeo ID", () => {
    expect(
      posterSyncAction({
        previousVimeoId: 151857510,
        nextVimeoId: 151857510,
        previousPoster,
        nextPoster: previousPoster,
      }),
    ).toBe("keep");
    expect(
      posterSyncAction({
        previousVimeoId: 151819909,
        nextVimeoId: 1175910961,
        previousPoster,
        nextPoster: "https://i.vimeocdn.com/video/chosen-d_1280x720?r=pad",
      }),
    ).toBe("keep");
  });
});

describe("vimeoOembedPageUrl", () => {
  it("builds a public video URL", () => {
    expect(vimeoOembedPageUrl(151859522)).toBe("https://vimeo.com/151859522");
  });

  it("adds an unlisted hash and rejects anything else", () => {
    expect(vimeoOembedPageUrl(151859522, "b1bc386c3c")).toBe(
      "https://vimeo.com/151859522/b1bc386c3c",
    );
    expect(vimeoOembedPageUrl(151859522, "bad hash")).toBeNull();
    expect(vimeoOembedPageUrl(0)).toBeNull();
  });
});

describe("syncSubmittedVideoPosters", () => {
  const oldPoster = "https://i.vimeocdn.com/video/old-d_1280x720?r=pad";
  const livePoster = "https://i.vimeocdn.com/video/live-d_1280x720?r=pad";

  it("replaces the old picture when the Vimeo ID changed and leaves the chosen picture alone", async () => {
    const videos = [
      { content_id: 249, title: "Parent", vimeo_id: 151819909, posterUrl: oldPoster },
      { content_id: "249-1", title: "Clip", vimeo_id: 1175910961, posterUrl: oldPoster },
    ];
    const fetchPoster = async (vimeoId: number) => {
      if (vimeoId === 1175910961) return { ok: true as const, posterUrl: livePoster };
      return { ok: false as const, error: "not called" };
    };
    const result = await syncSubmittedVideoPosters(
      videos,
      [
        { content_id: 249, vimeo_id: 151819909, posterUrl: oldPoster },
        { content_id: "249-1", vimeo_id: 151819909, posterUrl: oldPoster },
      ],
      new Map(),
      fetchPoster,
    );
    expect(result.ok).toBe(true);
    expect(videos[0]?.posterUrl).toBe(oldPoster);
    expect(videos[1]?.posterUrl).toBe(livePoster);
  });

  it("does not save when the new Vimeo ID has no thumbnail", async () => {
    const videos = [{ content_id: 522, title: "Gauge Swatch", vimeo_id: 999, posterUrl: oldPoster }];
    const result = await syncSubmittedVideoPosters(
      videos,
      [{ content_id: 522, vimeo_id: 151858429, posterUrl: oldPoster }],
      new Map(),
      async () => ({ ok: false, error: "Vimeo could not find that video." }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Gauge Swatch");
    expect(result.error).toContain("Nothing was saved");
    expect(videos[0]?.posterUrl).toBe(oldPoster);
  });
});

describe("fetchVimeoCatalogPoster", () => {
  it("returns the catalog poster from oEmbed", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ thumbnail_url: RAW }), { status: 200 });
    });
    const result = await fetchVimeoCatalogPoster(151859522, undefined, fetchImpl);
    expect(result).toEqual({ ok: true, posterUrl: CATALOG });
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain("width=1280");
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain(
      encodeURIComponent("https://vimeo.com/151859522"),
    );
  });

  it("reports a missing video", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 404 }));
    const result = await fetchVimeoCatalogPoster(151859522, undefined, fetchImpl);
    expect(result).toEqual({ ok: false, error: "Vimeo could not find that video." });
  });
});
