import { describe, expect, it, vi } from "vitest";
import {
  catalogPosterUrlFromThumbnail,
  fetchVimeoCatalogPoster,
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
