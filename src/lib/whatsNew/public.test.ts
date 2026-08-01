import { describe, expect, it } from "vitest";

import {
  buildPublicWhatsNewBoard,
  buildWhatsNewCard,
  filterPublicWhatsNewCards,
  groupWhatsNewCardsByColumn,
  isWithinNewBadgeWindow,
} from "./public";
import type { WhatsNewCard, WhatsNewCardRow } from "./types";

function row(overrides: Partial<WhatsNewCardRow> = {}): WhatsNewCardRow {
  return {
    id: "card-1",
    title: "Shape Shoulders Without the Guesswork",
    description: "Clear slope shaping steps.",
    category: "tool",
    destination_url: "/tools/slope",
    button_text: "Try It",
    board_column: "just_added",
    publish_date: "2026-07-20",
    featured: false,
    status: "published",
    display_order: 0,
    archived: false,
    created_at: "2026-07-20T00:00:00.000Z",
    updated_at: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("whats new public filtering and board grouping", () => {
  const now = new Date("2026-08-01T12:00:00.000Z");

  it("hides drafts and archived cards from the public board", () => {
    const cards = [
      buildWhatsNewCard(row({ id: "pub", status: "published", archived: false }), now)!,
      buildWhatsNewCard(row({ id: "draft", status: "draft", archived: false }), now)!,
      buildWhatsNewCard(row({ id: "arch", status: "published", archived: true }), now)!,
    ];

    const publicCards = filterPublicWhatsNewCards(cards);
    expect(publicCards.map((c) => c.id)).toEqual(["pub"]);
  });

  it("groups by board column and sorts by display order then publish date", () => {
    const cards: WhatsNewCard[] = [
      buildWhatsNewCard(
        row({
          id: "a",
          board_column: "just_added",
          display_order: 2,
          publish_date: "2026-07-01",
          title: "Later",
        }),
        now,
      )!,
      buildWhatsNewCard(
        row({
          id: "b",
          board_column: "just_added",
          display_order: 1,
          publish_date: "2026-06-01",
          title: "Earlier order",
        }),
        now,
      )!,
      buildWhatsNewCard(
        row({
          id: "c",
          board_column: "worth_exploring",
          display_order: 0,
          title: "Explore",
        }),
        now,
      )!,
      buildWhatsNewCard(
        row({
          id: "d",
          board_column: "in_the_pipeline",
          display_order: 0,
          title: "Pipeline",
        }),
        now,
      )!,
    ];

    const board = groupWhatsNewCardsByColumn(cards);
    expect(board.just_added.map((c) => c.id)).toEqual(["b", "a"]);
    expect(board.worth_exploring.map((c) => c.id)).toEqual(["c"]);
    expect(board.in_the_pipeline.map((c) => c.id)).toEqual(["d"]);
  });

  it("keeps CTA only when a destination URL exists", () => {
    const withUrl = buildWhatsNewCard(row({ destination_url: "/tools/slope", button_text: null }), now)!;
    const withoutUrl = buildWhatsNewCard(
      row({ id: "no-url", destination_url: null, button_text: "Try It" }),
      now,
    )!;

    expect(withUrl.destinationUrl).toBe("/tools/slope");
    expect(withUrl.buttonText).toBe("Try It");
    expect(withoutUrl.destinationUrl).toBeNull();
    expect(withoutUrl.buttonText).toBeNull();
  });

  it("tracks Featured separately from the age window used by Watson admin", () => {
    const recent = buildWhatsNewCard(row({ publish_date: "2026-07-15", featured: true }), now)!;
    const older = buildWhatsNewCard(
      row({ id: "old", publish_date: "2026-06-01", featured: false }),
      now,
    )!;

    expect(isWithinNewBadgeWindow("2026-07-15", now)).toBe(true);
    expect(isWithinNewBadgeWindow("2026-06-01", now)).toBe(false);
    expect(recent.featured).toBe(true);
    expect(older.featured).toBe(false);
  });

  it("buildPublicWhatsNewBoard drops non-public cards before grouping", () => {
    const board = buildPublicWhatsNewBoard([
      buildWhatsNewCard(row({ id: "pub", status: "published" }), now)!,
      buildWhatsNewCard(row({ id: "draft", status: "draft" }), now)!,
    ]);
    expect(board.just_added.map((c) => c.id)).toEqual(["pub"]);
  });

});
