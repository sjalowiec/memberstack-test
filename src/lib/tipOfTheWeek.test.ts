import { describe, expect, it } from "vitest";
import { applyVideoPosterOverrides } from "./videos/videoPosterOverrides";
import {
  formatTipAvailabilityDate,
  resolveTipCatalogVideo,
  tipAvailabilityFooter,
  tipOfTheWeek,
} from "./tipOfTheWeek";

describe("tipOfTheWeek config helpers", () => {
  it("exposes a single availableThrough value used by footer formatting", () => {
    expect(tipOfTheWeek.availableThrough).toBe("2026-08-14");
    const formatted = formatTipAvailabilityDate(tipOfTheWeek.availableThrough);
    expect(formatted).toBe("August 14, 2026");
    expect(tipAvailabilityFooter(tipOfTheWeek)).toContain(formatted);
    expect(tipAvailabilityFooter(tipOfTheWeek)).toBe(
      tipOfTheWeek.availabilityFooterTemplate.replace("{date}", formatted),
    );
  });

  it("resolves video 339 with Vimeo id and poster from the catalog", () => {
    const video = resolveTipCatalogVideo({
      videoContentId: 339,
    });
    expect(video?.vimeoId).toBe("151857510");
    expect(video?.posterUrl).toMatch(/^https:\/\//);
  });

  it("returns null when the catalog video cannot be identified", () => {
    expect(resolveTipCatalogVideo({ videoContentId: 999999 }, [])).toBeNull();
  });

  it("keeps the Vimeo id and the stored thumbnail from the same catalog row", () => {
    const catalog = [
      {
        content_id: 587,
        slug: "gathered-top-for-mittens-and-hats",
        title: "Gathered Top for Mittens and Hats",
        vimeo_id: 151859005,
        posterUrl: "https://i.vimeocdn.com/video/old-d_1280x720?r=pad",
      },
    ];
    const withPoster = applyVideoPosterOverrides(
      catalog,
      new Map([["587", "https://i.vimeocdn.com/video/stored-d_1280x720?r=pad"]]),
    );
    const video = resolveTipCatalogVideo({ videoContentId: "587" }, withPoster);
    expect(video?.vimeoId).toBe("151859005");
    expect(video?.posterUrl).toBe("https://i.vimeocdn.com/video/stored-d_1280x720?r=pad");
  });
});
