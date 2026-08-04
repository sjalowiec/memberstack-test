import { describe, expect, it } from "vitest";

import {
  boardColumnMeta,
  buildPublicWhatsNewBoard,
  buildWhatsNewCard,
  compareWhatsNewCards,
  filterPublicWhatsNewCards,
  groupWhatsNewCardsByColumn,
  hasManualWhatsNewDisplayOrder,
  isWithinNewBadgeWindow,
  splitPublicColumnCards,
  WHATS_NEW_PUBLIC_COLUMN_INITIAL_LIMIT,
} from "./public";
import type { WhatsNewCard, WhatsNewCardRow } from "./types";
import { WHATS_NEW_BOARD_COLUMN_META } from "./types";

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

  it("groups by board column; deliberate manual order beats default 0 / date sorting", () => {
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

  it("treats display_order 0 as automatic so default zeros do not count as manual order", () => {
    expect(hasManualWhatsNewDisplayOrder(0)).toBe(false);
    expect(hasManualWhatsNewDisplayOrder(1)).toBe(true);
    expect(hasManualWhatsNewDisplayOrder(-2)).toBe(true);
  });

  it("sorts cards without deliberate manual order newest first, then by title", () => {
    const cards: WhatsNewCard[] = [
      buildWhatsNewCard(
        row({
          id: "old",
          display_order: 0,
          publish_date: "2026-06-01",
          title: "Older",
        }),
        now,
      )!,
      buildWhatsNewCard(
        row({
          id: "new-b",
          display_order: 0,
          publish_date: "2026-07-20",
          title: "B newest",
        }),
        now,
      )!,
      buildWhatsNewCard(
        row({
          id: "new-a",
          display_order: 0,
          publish_date: "2026-07-20",
          title: "A newest",
        }),
        now,
      )!,
    ];

    const board = groupWhatsNewCardsByColumn(cards);
    expect(board.just_added.map((c) => c.id)).toEqual(["new-a", "new-b", "old"]);
  });

  it("places deliberately ordered cards ahead of automatic (0) cards, ordered by displayOrder", () => {
    const cards: WhatsNewCard[] = [
      buildWhatsNewCard(
        row({
          id: "auto-new",
          display_order: 0,
          publish_date: "2026-08-04",
          title: "Auto newest",
        }),
        now,
      )!,
      buildWhatsNewCard(
        row({
          id: "manual-2",
          display_order: 2,
          publish_date: "2026-05-01",
          title: "Manual two",
        }),
        now,
      )!,
      buildWhatsNewCard(
        row({
          id: "manual-1",
          display_order: 1,
          publish_date: "2026-04-01",
          title: "Manual one",
        }),
        now,
      )!,
      buildWhatsNewCard(
        row({
          id: "auto-old",
          display_order: 0,
          publish_date: "2026-07-01",
          title: "Auto older",
        }),
        now,
      )!,
    ];

    const board = groupWhatsNewCardsByColumn(cards);
    expect(board.just_added.map((c) => c.id)).toEqual([
      "manual-1",
      "manual-2",
      "auto-new",
      "auto-old",
    ]);
  });

  it("uses title only as the final stable tie-breaker when order and date match", () => {
    const zebra = buildWhatsNewCard(
      row({
        id: "z",
        display_order: 3,
        publish_date: "2026-07-20",
        title: "Zebra",
      }),
      now,
    )!;
    const apple = buildWhatsNewCard(
      row({
        id: "a",
        display_order: 3,
        publish_date: "2026-07-20",
        title: "Apple",
      }),
      now,
    )!;
    expect(compareWhatsNewCards(zebra, apple)).toBeGreaterThan(0);
    expect(compareWhatsNewCards(apple, zebra)).toBeLessThan(0);
    expect(
      groupWhatsNewCardsByColumn([zebra, apple]).just_added.map((c) => c.id),
    ).toEqual(["a", "z"]);
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

  it("displays Worth Exploring as Bugs & Improvements without changing the stored slug", () => {
    expect(WHATS_NEW_BOARD_COLUMN_META.worth_exploring.title).toBe("Bugs & Improvements");
    expect(WHATS_NEW_BOARD_COLUMN_META.worth_exploring.subtitle).toBe(
      "Fixes and improvements to your Knit It Now experience",
    );
    expect(boardColumnMeta("worth_exploring").title).toBe("Bugs & Improvements");
    expect(WHATS_NEW_BOARD_COLUMN_META.just_added.subtitle).toBe(
      "New tools, patterns, resources, and features",
    );
    expect(WHATS_NEW_BOARD_COLUMN_META.in_the_pipeline.subtitle).toBe(
      "A peek at what's being developed",
    );

    const card = buildWhatsNewCard(
      row({ id: "we", board_column: "worth_exploring", title: "Fix" }),
      now,
    )!;
    const board = buildPublicWhatsNewBoard([card]);
    expect(card.boardColumn).toBe("worth_exploring");
    expect(board.worth_exploring.map((c) => c.id)).toEqual(["we"]);
  });

  it("limits each public column to the initial visible set with an optional remainder", () => {
    expect(WHATS_NEW_PUBLIC_COLUMN_INITIAL_LIMIT).toBe(3);

    const five = ["a", "b", "c", "d", "e"];
    const splitFive = splitPublicColumnCards(five);
    expect(splitFive.initial).toEqual(["a", "b", "c"]);
    expect(splitFive.remaining).toEqual(["d", "e"]);
    expect(splitFive.hasMore).toBe(true);

    const three = ["a", "b", "c"];
    const splitThree = splitPublicColumnCards(three);
    expect(splitThree.initial).toEqual(["a", "b", "c"]);
    expect(splitThree.remaining).toEqual([]);
    expect(splitThree.hasMore).toBe(false);

    const two = ["a", "b"];
    const splitTwo = splitPublicColumnCards(two);
    expect(splitTwo.hasMore).toBe(false);
    expect(splitTwo.remaining).toEqual([]);
  });

  it("keeps draft and archived cards out of the public board even in Bugs & Improvements", () => {
    const board = buildPublicWhatsNewBoard([
      buildWhatsNewCard(
        row({
          id: "pub-we",
          board_column: "worth_exploring",
          status: "published",
          archived: false,
        }),
        now,
      )!,
      buildWhatsNewCard(
        row({
          id: "draft-we",
          board_column: "worth_exploring",
          status: "draft",
        }),
        now,
      )!,
      buildWhatsNewCard(
        row({
          id: "arch-we",
          board_column: "worth_exploring",
          status: "published",
          archived: true,
        }),
        now,
      )!,
    ]);
    expect(board.worth_exploring.map((c) => c.id)).toEqual(["pub-we"]);
  });

});
