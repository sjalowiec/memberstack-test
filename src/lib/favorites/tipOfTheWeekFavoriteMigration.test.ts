import { describe, expect, it } from "vitest";
import {
  isRotatingTipOfTheWeekFavorite,
  planTipOfTheWeekFavorite,
  referenceFavoriteUsesTipOfTheWeek,
  tipFavoritesToConvert,
} from "./tipOfTheWeekFavoriteMigration";
import {
  permanentTipVideoHref,
  tipVideoIdsForFavoriteMigration,
} from "./savedContentCatalog";

const tips = [
  { contentId: "cast-on", videoContentId: "339" },
  { contentId: "no-video", videoContentId: "  " },
];

describe("planTipOfTheWeekFavorite", () => {
  it("converts a saved tip id to that tip's video", () => {
    expect(planTipOfTheWeekFavorite("cast-on", tips)).toEqual({
      action: "convert",
      videoContentId: "339",
      via: "tip",
    });
    expect(planTipOfTheWeekFavorite("/tip-of-the-week?tip=cast-on", tips)).toEqual({
      action: "convert",
      videoContentId: "339",
      via: "tip",
    });
    expect(
      planTipOfTheWeekFavorite("https://knititnow.com/tip-of-the-week?tip=cast-on", tips),
    ).toEqual({
      action: "convert",
      videoContentId: "339",
      via: "tip",
    });
  });

  it("converts a stored video permalink without guessing", () => {
    expect(planTipOfTheWeekFavorite("/videos/339", [])).toEqual({
      action: "convert",
      videoContentId: "339",
      via: "video-permalink",
    });
  });

  it("excludes the rotating tip page and unknown tip ids", () => {
    expect(planTipOfTheWeekFavorite("/tip-of-the-week", tips)).toEqual({
      action: "exclude",
      reason: "rotating-url",
    });
    expect(planTipOfTheWeekFavorite("https://kin-dev.netlify.app/tip-of-the-week/", [])).toEqual({
      action: "exclude",
      reason: "rotating-url",
    });
    expect(isRotatingTipOfTheWeekFavorite("tip-of-the-week")).toBe(true);
    expect(planTipOfTheWeekFavorite("missing-tip", tips)).toEqual({
      action: "exclude",
      reason: "unresolved",
    });
    expect(planTipOfTheWeekFavorite("no-video", tips)).toEqual({
      action: "exclude",
      reason: "unresolved",
    });
  });

  it("leaves ordinary reference favorites alone", () => {
    expect(planTipOfTheWeekFavorite("/glossary", tips)).toEqual({ action: "keep" });
    expect(planTipOfTheWeekFavorite("/help-hub/sponge-bar", tips)).toEqual({ action: "keep" });
    expect(referenceFavoriteUsesTipOfTheWeek("/glossary")).toBe(false);
    expect(referenceFavoriteUsesTipOfTheWeek("/videos/339")).toBe(false);
    expect(referenceFavoriteUsesTipOfTheWeek("/tip-of-the-week")).toBe(true);
    expect(referenceFavoriteUsesTipOfTheWeek("/tip-of-the-week?tip=cast-on")).toBe(true);
  });
});

describe("tipFavoritesToConvert", () => {
  it("converts tip favorites and tip URLs, and skips rotating or unrelated rows", () => {
    expect(
      tipFavoritesToConvert(
        [
          { contentType: "tip-of-the-week", contentId: "cast-on" },
          { contentType: "tip-of-the-week", contentId: "/tip-of-the-week" },
          { contentType: "tip-of-the-week", contentId: "missing-tip" },
          { contentType: "reference", contentId: "/tip-of-the-week?tip=cast-on" },
          { contentType: "reference", contentId: "/glossary" },
          { contentType: "reference", contentId: "/videos/12" },
        ],
        tips,
      ),
    ).toEqual([
      { contentType: "tip-of-the-week", contentId: "cast-on", videoContentId: "339" },
      { contentType: "reference", contentId: "/tip-of-the-week?tip=cast-on", videoContentId: "339" },
    ]);
  });
});

describe("tip video helpers", () => {
  it("keeps one video id per tip and builds the permanent video link", () => {
    expect(
      tipVideoIdsForFavoriteMigration([
        { tipId: "cast-on", videoContentId: " 339 " },
        { tipId: "cast-on", videoContentId: "999" },
        { tipId: "blank", videoContentId: " " },
      ]),
    ).toEqual([{ contentId: "cast-on", videoContentId: "339" }]);
    expect(permanentTipVideoHref("339")).toBe("/videos/339");
    expect(permanentTipVideoHref("  ")).toBe("");
  });
});
