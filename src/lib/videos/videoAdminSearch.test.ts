import { describe, expect, it } from "vitest";
import videos from "../../data/videos-public.json";
import { videoMatchesAdminSearch } from "./videoAdminSearch";

const catalog = videos as Array<{
  content_id: string | number;
  title?: string;
  slug?: string;
  vimeo_id?: number;
}>;

describe("video admin search", () => {
  it("finds Knit It Now video 707 and its Vimeo ID without matching nearby numbers", () => {
    const matches = catalog.filter((video) => videoMatchesAdminSearch(video, "KIN video 707"));
    expect(matches.map((video) => video.content_id)).toEqual([707]);
    expect(matches[0]?.title).toBe("No Fuss, Upside-Down, Hung Hem");
    expect(matches[0]?.vimeo_id).toBe(151859846);
  });

  it("matches a bare video number or an exact Vimeo ID", () => {
    expect(catalog.filter((video) => videoMatchesAdminSearch(video, "707")).map((video) => video.content_id)).toEqual([
      707,
    ]);
    expect(
      catalog.filter((video) => videoMatchesAdminSearch(video, "151859846")).map((video) => video.content_id),
    ).toEqual([707]);
    expect(
      catalog.filter((video) => videoMatchesAdminSearch(video, "151859707")).map((video) => video.content_id),
    ).toEqual([679]);
  });

  it("matches a title without requiring the whole name", () => {
    const matches = catalog.filter((video) => videoMatchesAdminSearch(video, "upside-down"));
    expect(matches.map((video) => video.content_id)).toContain(707);
  });
});
