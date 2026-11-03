import { describe, expect, it } from "vitest";
import {
  accountHelpHubFavoriteItemHtml,
  accountHelpHubFavorites,
  referenceFavoriteIdsForAccount,
} from "./accountHelpHubFavorites";
import { isRotatingTipOfTheWeekFavorite } from "./tipOfTheWeekFavoriteMigration";

const catalog = [
  {
    slug: "older",
    question: "Older question?",
    contentId: "/help-hub/older",
  },
  {
    slug: "newer",
    question: "Newer question?",
    contentId: "/help-hub/newer",
  },
];

describe("account Help Hub favorites", () => {
  const favorites = [
    { content_id: "/glossary", created_at: "2026-10-03T00:00:00.000Z" },
    { content_id: "/help-hub/older", created_at: "2026-10-01T00:00:00.000Z" },
    { content_id: "/help-hub/newer", created_at: "2026-10-02T00:00:00.000Z" },
    { content_id: "/help-hub/draft-tip", created_at: "2026-10-04T00:00:00.000Z" },
    { content_id: "/tip-of-the-week", created_at: "2026-10-05T00:00:00.000Z" },
  ];

  it("uses the Help Hub catalog titles, permanent links, and stored ids", () => {
    expect(accountHelpHubFavorites(favorites, catalog)).toEqual([
      {
        contentId: "/help-hub/newer",
        title: "Newer question?",
        href: "/help-hub/newer",
      },
      {
        contentId: "/help-hub/older",
        title: "Older question?",
        href: "/help-hub/older",
      },
    ]);
  });

  it("keeps a slug link when the catalog cannot be loaded", () => {
    expect(accountHelpHubFavorites(favorites, null).map((item) => item.href)).toEqual([
      "/help-hub/draft-tip",
      "/help-hub/newer",
      "/help-hub/older",
    ]);
  });

  it("keeps reference pages separate from Help Hub and the rotating tip", () => {
    expect(referenceFavoriteIdsForAccount(favorites, isRotatingTipOfTheWeekFavorite)).toEqual([
      "/glossary",
    ]);
  });

  it("removes a Help Hub row with the stored reference id", () => {
    const html = accountHelpHubFavoriteItemHtml({
      contentId: "/help-hub/newer",
      title: "Newer question?",
      href: "/help-hub/newer",
    });
    expect(html).toContain('href="/help-hub/newer"');
    expect(html).toContain("Newer question?");
    expect(html).toContain('data-content-type="reference"');
    expect(html).toContain('data-content-id="/help-hub/newer"');
    expect(html).toContain('data-favorite-content-type="reference"');
    expect(html).toContain('aria-pressed="true"');
  });
});
