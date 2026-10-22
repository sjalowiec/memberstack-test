import { describe, expect, it } from "vitest";
import {
  CONTENT_FAVORITE_ID_PARAM,
  CONTENT_FAVORITE_OPEN_EVENT,
  CONTENT_FAVORITE_SAVE_EVENT,
  CONTENT_FAVORITE_SOURCE_PARAM,
  CONTENT_FAVORITE_TYPE_PARAM,
  CONTENT_FAVORITE_UNSAVE_EVENT,
  CONTENT_FAVORITES_OPEN_EVENT,
  reportContentFavoriteOpen,
  reportContentFavoritesOpen,
  resetContentFavoritesGaForTests,
  shouldReportContentFavoritesToProductionGa,
  trackSavedContentFavoriteChange,
  type ContentFavoritesGaContext,
} from "./contentFavoritesGa";

function productionContext(): { calls: unknown[][]; context: ContentFavoritesGaContext } {
  const calls: unknown[][] = [];
  return {
    calls,
    context: {
      now: 1_000,
      hostname: "www.knititnow.com",
      isViteDev: false,
      publicSiteEnv: "production",
      measurementIdConfigured: true,
      gtag: (...args: unknown[]) => {
        calls.push(args);
      },
    },
  };
}

describe("content favorites analytics", () => {
  it("stays off localhost and the dev site", () => {
    expect(
      shouldReportContentFavoritesToProductionGa({
        hostname: "localhost",
        isViteDev: true,
      }),
    ).toBe(false);
    expect(
      shouldReportContentFavoritesToProductionGa({
        hostname: "kin-dev.netlify.app",
        isViteDev: false,
      }),
    ).toBe(false);
  });

  it("records a successful save with type, id, and source, and skips other content", () => {
    resetContentFavoritesGaForTests();
    const { calls, context } = productionContext();
    expect(
      trackSavedContentFavoriteChange(
        {
          contentType: "tip-of-the-week",
          contentId: "cast-on",
          isFavorite: true,
          source: "tip-page",
        },
        context,
      ),
    ).toBe(true);
    expect(
      trackSavedContentFavoriteChange(
        {
          contentType: "video",
          contentId: "10",
          isFavorite: true,
          source: "page",
        },
        context,
      ),
    ).toBe(false);
    expect(
      trackSavedContentFavoriteChange(
        {
          contentType: "knit-able",
          contentId: "sue@example.com",
          isFavorite: true,
          source: "knit-able-card",
        },
        context,
      ),
    ).toBe(false);

    expect(calls).toEqual([
      [
        "event",
        CONTENT_FAVORITE_SAVE_EVENT,
        {
          [CONTENT_FAVORITE_TYPE_PARAM]: "tip-of-the-week",
          [CONTENT_FAVORITE_ID_PARAM]: "cast-on",
          [CONTENT_FAVORITE_SOURCE_PARAM]: "tip-page",
          transport_type: "beacon",
        },
      ],
    ]);
    expect(JSON.stringify(calls)).not.toMatch(/@|mem_/i);
  });

  it("records an unsave, an accordion open, and a saved-link open", () => {
    resetContentFavoritesGaForTests();
    const { calls, context } = productionContext();
    expect(
      trackSavedContentFavoriteChange(
        {
          contentType: "knit-able",
          contentId: "vest-in-show",
          isFavorite: false,
          source: "account",
        },
        context,
      ),
    ).toBe(true);
    expect(reportContentFavoritesOpen(context)).toBe(true);
    expect(
      reportContentFavoriteOpen(
        { contentType: "tip-of-the-week", contentId: "cast-on", source: "account" },
        { ...context, now: 2_000 },
      ),
    ).toBe(true);

    expect(calls.map((call) => call[1])).toEqual([
      CONTENT_FAVORITE_UNSAVE_EVENT,
      CONTENT_FAVORITES_OPEN_EVENT,
      CONTENT_FAVORITE_OPEN_EVENT,
    ]);
  });
});
