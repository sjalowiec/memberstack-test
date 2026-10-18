import { describe, expect, it } from "vitest";
import {
  HELP_HUB_FAVORITES_EMPTY_MESSAGE,
  helpHubFavoriteRowHtml,
  helpHubFavoriteTipCatalog,
  helpHubFavoriteTipRows,
} from "./favoriteTips";
import type { HelpHubTipRecord } from "../helpHubPublic";

const published = (overrides: HelpHubTipRecord): HelpHubTipRecord => ({
  status: "published",
  ...overrides,
});

describe("helpHubFavoriteTipCatalog", () => {
  const tips: HelpHubTipRecord[] = [
    published({
      slug: "sponge-bar",
      question: "Why is the carriage sticking?",
    }),
    published({
      slug: "draft-looking",
      question: "",
      title: "Title only",
    }),
    {
      slug: "draft-tip",
      status: "draft",
      question: "Should a draft appear?",
    },
    {
      slug: "review-tip",
      status: "review",
      question: "Should a review appear?",
    },
    published({
      slug: "removed-tip",
      deletedAt: "2026-09-01T00:00:00.000Z",
      question: "Was this removed?",
    }),
  ];

  it("keeps published Help Hub questions and leaves drafts out", () => {
    expect(helpHubFavoriteTipCatalog(tips)).toEqual([
      {
        slug: "sponge-bar",
        question: "Why is the carriage sticking?",
        contentId: "/help-hub/sponge-bar",
      },
    ]);
  });
});

describe("helpHubFavoriteTipRows", () => {
  const catalog = helpHubFavoriteTipCatalog([
    published({ slug: "older", question: "Older question?" }),
    published({ slug: "newer", question: "Newer question?" }),
  ]);

  it("shows saved published tips newest first and skips other favorites", () => {
    expect(
      helpHubFavoriteTipRows(catalog, [
        { content_id: "/glossary", created_at: "2026-10-03T00:00:00.000Z" },
        { content_id: "/help-hub/older", created_at: "2026-10-01T00:00:00.000Z" },
        { content_id: "/help-hub/newer", created_at: "2026-10-02T00:00:00.000Z" },
        { content_id: "/help-hub/draft-tip", created_at: "2026-10-04T00:00:00.000Z" },
        { content_id: "/help-hub/newer", created_at: "2026-09-01T00:00:00.000Z" },
      ]).map((tip) => tip.slug),
    ).toEqual(["newer", "older"]);
  });
});

describe("helpHubFavoriteRowHtml", () => {
  it("renders a question link and a filled star with the short tooltip", () => {
    const html = helpHubFavoriteRowHtml({
      slug: "sponge-bar",
      question: 'Why is the carriage "sticking"?',
      contentId: "/help-hub/sponge-bar",
    });
    expect(html).toContain('href="/help-hub/sponge-bar"');
    expect(html).toContain("<strong>Why is the carriage &quot;sticking&quot;?</strong>");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('data-tooltip="Remove from favorites"');
    expect(html).toContain("fa-solid fa-star");
    expect(html).not.toContain("talk-bubble");
    expect(HELP_HUB_FAVORITES_EMPTY_MESSAGE).toBe(
      "Save tips using the star, and you’ll find them here.",
    );
  });
});
