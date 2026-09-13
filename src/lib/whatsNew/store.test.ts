import { describe, expect, it, vi } from "vitest";

import {
  archiveWhatsNewCard,
  createWhatsNewCard,
  deleteWhatsNewCard,
  getPublicBillboardSettings,
  listAllWhatsNewCards,
  listPublicWhatsNewCards,
  updateWhatsNewCard,
  upsertWhatsNewBillboardSettings,
  WHATS_NEW_CARDS_ALL_SQL,
  WHATS_NEW_CARDS_PUBLIC_SQL,
  WHATS_NEW_DELETE_ACTIVE_PUBLISHED_ERROR,
} from "./store";
import type { WhatsNewBillboardSettingsRow, WhatsNewCardRow } from "./types";

const now = new Date("2026-08-01T19:00:00.000Z");

function cardRow(overrides: Partial<WhatsNewCardRow> = {}): WhatsNewCardRow {
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
    status: "draft",
    display_order: 0,
    archived: false,
    created_at: "2026-07-20T00:00:00.000Z",
    updated_at: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("whatsNew store", () => {
  it("admin list includes draft cards that the public query excludes", async () => {
    expect(WHATS_NEW_CARDS_ALL_SQL).not.toContain("status = 'published'");
    expect(WHATS_NEW_CARDS_PUBLIC_SQL).toContain("status = 'published'");

    const rows = [
      cardRow({ id: "draft-1", status: "draft", archived: false }),
      cardRow({ id: "pub-1", status: "published", archived: false }),
      cardRow({ id: "arch-1", status: "published", archived: true }),
    ];
    const adminCards = await listAllWhatsNewCards(vi.fn().mockResolvedValue(rows), now);
    expect(adminCards.map((card) => card.id)).toEqual(["draft-1", "pub-1", "arch-1"]);
    expect(adminCards.some((card) => card.status === "draft")).toBe(true);

    const publicCards = await listPublicWhatsNewCards(
      vi.fn().mockResolvedValue([rows[1]]),
      now,
    );
    expect(publicCards.map((card) => card.id)).toEqual(["pub-1"]);
    expect(publicCards.every((card) => card.status === "published")).toBe(true);
  });

  it("changes a draft to published by updating the existing row", async () => {
    const existing = cardRow({ id: "card-1", status: "draft" });
    const published = cardRow({ id: "card-1", status: "published" });
    const queryFn = vi.fn().mockResolvedValueOnce([existing]).mockResolvedValueOnce([published]);
    const result = await updateWhatsNewCard("card-1", { status: "published" }, queryFn, now);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe("published");
    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(String(queryFn.mock.calls[1]?.[0])).toContain("UPDATE watson_whats_new_cards");
    expect(String(queryFn.mock.calls[1]?.[0])).not.toMatch(/INSERT INTO watson_whats_new_cards/);
    expect(queryFn.mock.calls[1]?.[1]?.[0]).toBe("card-1");
    expect(queryFn.mock.calls[1]?.[1]?.[9]).toBe("published");
  });

  it("changes a published card to draft by updating the existing row", async () => {
    const existing = cardRow({ id: "card-1", status: "published" });
    const draft = cardRow({ id: "card-1", status: "draft" });
    const queryFn = vi.fn().mockResolvedValueOnce([existing]).mockResolvedValueOnce([draft]);
    const result = await updateWhatsNewCard("card-1", { status: "draft" }, queryFn, now);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe("draft");
    expect(String(queryFn.mock.calls[1]?.[0])).toContain("UPDATE watson_whats_new_cards");
    expect(String(queryFn.mock.calls[1]?.[0])).not.toMatch(/INSERT INTO watson_whats_new_cards/);
    expect(queryFn.mock.calls[1]?.[1]?.[0]).toBe("card-1");
    expect(queryFn.mock.calls[1]?.[1]?.[9]).toBe("draft");
  });

  it("lists only rows returned by the public query", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([cardRow({ status: "published" })]);
    const cards = await listPublicWhatsNewCards(queryFn, now);
    expect(queryFn).toHaveBeenCalledWith(WHATS_NEW_CARDS_PUBLIC_SQL);
    expect(cards).toHaveLength(1);
    expect(cards[0]?.status).toBe("published");
  });

  it("creates a card with validated fields", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([cardRow()]);
    const result = await createWhatsNewCard(
      {
        title: "Shape Shoulders Without the Guesswork",
        description: "Clear slope shaping steps.",
        category: "tool",
        destinationUrl: "/tools/slope",
        boardColumn: "just_added",
        status: "draft",
      },
      queryFn,
      now,
    );
    expect(result.ok).toBe(true);
    expect(queryFn.mock.calls[0]?.[1]?.[0]).toBe("Shape Shoulders Without the Guesswork");
    expect(queryFn.mock.calls[0]?.[1]?.[3]).toBe("/tools/slope");
    expect(queryFn.mock.calls[0]?.[1]?.[8]).toBe("draft");
  });

  it("updates, archives, and restores a card", async () => {
    const existing = cardRow({ status: "published" });
    const archived = cardRow({ archived: true, status: "published" });
    const restored = cardRow({ archived: false, status: "published" });

    const archiveQuery = vi
      .fn()
      .mockResolvedValueOnce([existing])
      .mockResolvedValueOnce([archived]);
    const archivedResult = await archiveWhatsNewCard("card-1", true, archiveQuery, now);
    expect(archivedResult.ok).toBe(true);
    if (archivedResult.ok) {
      expect(archivedResult.value.archived).toBe(true);
    }

    const restoreQuery = vi
      .fn()
      .mockResolvedValueOnce([archived])
      .mockResolvedValueOnce([restored]);
    const restoredResult = await archiveWhatsNewCard("card-1", false, restoreQuery, now);
    expect(restoredResult.ok).toBe(true);
    if (restoredResult.ok) {
      expect(restoredResult.value.archived).toBe(false);
    }

    const moved = cardRow({ board_column: "worth_exploring", status: "published" });
    const moveQuery = vi.fn().mockResolvedValueOnce([existing]).mockResolvedValueOnce([moved]);
    const movedResult = await updateWhatsNewCard(
      "card-1",
      { boardColumn: "worth_exploring" },
      moveQuery,
      now,
    );
    expect(movedResult.ok).toBe(true);
    if (movedResult.ok) {
      expect(movedResult.value.boardColumn).toBe("worth_exploring");
    }
  });

  it("permanently deletes a draft card", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce([cardRow({ status: "draft", archived: false })])
      .mockResolvedValueOnce([]);
    const result = await deleteWhatsNewCard("card-1", queryFn, now);
    expect(result.ok).toBe(true);
    expect(queryFn).toHaveBeenCalledTimes(2);
    const deleteCall = queryFn.mock.calls[1];
    expect(String(deleteCall?.[0])).toContain("DELETE FROM watson_whats_new_cards");
    expect(deleteCall?.[1]).toEqual(["card-1"]);
  });

  it("permanently deletes an archived card", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce([cardRow({ status: "published", archived: true })])
      .mockResolvedValueOnce([]);
    const result = await deleteWhatsNewCard("card-1", queryFn, now);
    expect(result.ok).toBe(true);
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it("refuses to delete an actively published, non-archived card", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce([cardRow({ status: "published", archived: false })]);
    const result = await deleteWhatsNewCard("card-1", queryFn, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(WHATS_NEW_DELETE_ACTIVE_PUBLISHED_ERROR);
    // Only the lookup ran; no DELETE was issued.
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("returns not found when deleting a missing card", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([]);
    const result = await deleteWhatsNewCard("missing", queryFn, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Delete card not found.");
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("rejects a missing card id without querying", async () => {
    const queryFn = vi.fn();
    const result = await deleteWhatsNewCard("   ", queryFn, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Card id is required.");
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("upserts billboard settings and respects public scheduling", async () => {
    const settingsRow: WhatsNewBillboardSettingsRow = {
      key: "featured_video",
      headline: "A quick look",
      introduction: "See what's new",
      original_video_url: null,
      safe_vimeo_embed_url: null,
      publish_date: null,
      button_text: "Explore",
      button_destination_url: "/tools",
      start_date: "2026-08-01",
      end_date: "2026-08-31",
      enabled: true,
      updated_at: "2026-08-01T00:00:00.000Z",
    };

    const saveQuery = vi.fn().mockResolvedValueOnce([settingsRow]);
    const saved = await upsertWhatsNewBillboardSettings(
      {
        headline: "A quick look",
        message: "See what's new",
        buttonText: "Explore",
        buttonDestinationUrl: "/tools",
        startDate: "2026-08-01",
        endDate: "2026-08-31",
        enabled: true,
      },
      saveQuery,
    );
    expect(saved.ok).toBe(true);

    const publicEnabled = vi.fn().mockResolvedValueOnce([settingsRow]);
    expect(await getPublicBillboardSettings(publicEnabled, now)).not.toBeNull();

    const publicDisabled = vi
      .fn()
      .mockResolvedValueOnce([{ ...settingsRow, enabled: false }]);
    expect(await getPublicBillboardSettings(publicDisabled, now)).toBeNull();
  });
});
