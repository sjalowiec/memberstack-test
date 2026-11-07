import { describe, expect, it } from "vitest";

import { announcementToShow } from "./announcement";
import {
  buildPopupAnnouncement,
  formatLosAngelesDateTime,
  inclusiveLosAngelesDayEnd,
  isPopupAnnouncementActive,
  losAngelesDateTimeLocalToUtc,
  popupReadMoreHref,
  shouldMintAnnouncementId,
  utcToLosAngelesDateTimeLocal,
  validatePopupAnnouncementInput,
  type WhatsNewPopupAnnouncement,
  type WhatsNewPopupAnnouncementRow,
} from "./popupAnnouncement";

function announcement(
  overrides: Partial<WhatsNewPopupAnnouncement> = {},
): WhatsNewPopupAnnouncement {
  return {
    id: "announcement-1",
    sourceCardId: "card-1",
    title: "Help Hub",
    introductionHtml: "<p>Find answers in the Help Hub.</p>",
    buttonDestinationUrl: null,
    href: "/whats-new#whats-new-entry-card-1",
    audience: "everyone",
    expiresAt: null,
    expiresAtLocal: "",
    enabled: true,
    updatedAt: "2026-10-18T00:00:00.000Z",
    ...overrides,
  };
}

describe("pop-up announcement schedule", () => {
  it("treats the expiration as America/Los_Angeles wall time", () => {
    const summer = losAngelesDateTimeLocalToUtc("2026-10-18T18:00");
    const winter = losAngelesDateTimeLocalToUtc("2026-01-15T18:00");
    expect(summer?.toISOString()).toBe("2026-10-19T01:00:00.000Z");
    expect(winter?.toISOString()).toBe("2026-01-16T02:00:00.000Z");
    expect(utcToLosAngelesDateTimeLocal("2026-10-19T01:00:00.000Z")).toBe("2026-10-18T18:00");
    expect(formatLosAngelesDateTime("2026-10-19T01:00:00.000Z")).toContain("America/Los_Angeles");
    expect(inclusiveLosAngelesDayEnd("2026-10-18")).toBe("2026-10-19T07:00:00.000Z");
  });

  it("hides a disabled or expired announcement and keeps one active announcement", () => {
    const now = new Date("2026-10-18T20:00:00.000Z");
    expect(isPopupAnnouncementActive(announcement(), now)).toBe(true);
    expect(isPopupAnnouncementActive(announcement({ enabled: false }), now)).toBe(false);
    expect(
      isPopupAnnouncementActive(
        announcement({ expiresAt: "2026-10-18T19:00:00.000Z" }),
        now,
      ),
    ).toBe(false);
    expect(
      isPopupAnnouncementActive(
        announcement({ expiresAt: "2026-10-18T21:00:00.000Z" }),
        now,
      ),
    ).toBe(true);
  });

  it("gives a different entry a new id and keeps edits of the same entry", () => {
    const existing = { id: "announcement-1", sourceCardId: "card-1" };
    expect(shouldMintAnnouncementId(existing, "card-1")).toBe(false);
    expect(shouldMintAnnouncementId(existing, "card-2")).toBe(true);
    expect(shouldMintAnnouncementId(null, "card-1")).toBe(true);
  });

  it("does not let a dismissed announcement hide a different one", () => {
    const first = {
      id: "announcement-1",
      title: "Help Hub",
      introductionHtml: "<p>Hello</p>",
      href: "/whats-new",
      audience: "everyone" as const,
    };
    const next = { ...first, id: "announcement-2", title: "A newer note" };
    const seen = (id: string) => id === "announcement-1";
    expect(announcementToShow(first, false, seen)).toBeNull();
    expect(announcementToShow(next, false, seen)?.id).toBe("announcement-2");
    expect(announcementToShow({ ...next, audience: "members" }, false, () => false)).toBeNull();
    expect(announcementToShow({ ...next, audience: "members" }, true, () => false)?.id).toBe(
      "announcement-2",
    );
  });

  it("uses a button destination for Read more and keeps the What's New entry when blank", () => {
    expect(popupReadMoreHref("card-1", null)).toBe("/whats-new#whats-new-entry-card-1");
    expect(popupReadMoreHref("card-1", "   ")).toBe("/whats-new#whats-new-entry-card-1");
    expect(popupReadMoreHref(null, null)).toBe("/whats-new");
    expect(popupReadMoreHref("card-1", "/testimonials")).toBe("/testimonials");
    expect(popupReadMoreHref("card-1", "javascript:alert(1)")).toBe(
      "/whats-new#whats-new-entry-card-1",
    );
  });

  it("keeps audience and expiration when a button destination is saved", () => {
    const saved = validatePopupAnnouncementInput({
      title: "What Knitters Say",
      introductionHtml: "<p>Stories from knitters.</p>",
      audience: "members",
      expiresAtLocal: "2026-12-01T09:00",
      sourceCardId: "card-9",
      buttonDestinationUrl: "/testimonials",
      enabled: true,
    });
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(saved.value.buttonDestinationUrl).toBe("/testimonials");
      expect(saved.value.audience).toBe("members");
      expect(saved.value.expiresAt).toBe("2026-12-01T17:00:00.000Z");
      expect(saved.value.sourceCardId).toBe("card-9");
    }
  });

  it("treats a blank button destination as no override and rejects an unsafe one", () => {
    const blank = validatePopupAnnouncementInput({
      title: "What Knitters Say",
      introductionHtml: "<p>Stories from knitters.</p>",
      buttonDestinationUrl: "   ",
    });
    expect(blank.ok).toBe(true);
    if (blank.ok) expect(blank.value.buttonDestinationUrl).toBeNull();

    const unsafe = validatePopupAnnouncementInput({
      title: "What Knitters Say",
      introductionHtml: "<p>Stories from knitters.</p>",
      buttonDestinationUrl: "javascript:alert(1)",
    });
    expect(unsafe.ok).toBe(false);
  });

  it("builds the public Read more link from the saved destination", () => {
    const row: WhatsNewPopupAnnouncementRow = {
      announcement_id: "announcement-1",
      source_card_id: "card-1",
      title: "What Knitters Say",
      introduction: "<p>Stories from knitters.</p>",
      audience: "everyone",
      expires_at: "2026-12-01T17:00:00.000Z",
      enabled: true,
      updated_at: "2026-10-18T00:00:00.000Z",
    };
    const fallback = buildPopupAnnouncement(row);
    expect(fallback?.href).toBe("/whats-new#whats-new-entry-card-1");
    expect(fallback?.buttonDestinationUrl).toBeNull();
    expect(fallback?.audience).toBe("everyone");
    expect(fallback?.expiresAt).toBe("2026-12-01T17:00:00.000Z");

    const direct = buildPopupAnnouncement({
      ...row,
      button_destination_url: "/testimonials",
    });
    expect(direct?.href).toBe("/testimonials");
    expect(direct?.buttonDestinationUrl).toBe("/testimonials");
    expect(direct?.audience).toBe("everyone");
    expect(direct?.expiresAt).toBe("2026-12-01T17:00:00.000Z");
  });

  it("accepts an independent draft without requiring the source entry to stay unchanged", () => {
    const saved = validatePopupAnnouncementInput({
      title: "Edited pop-up title",
      introductionHtml: "<p>Edited message.</p>",
      audience: "members",
      expiresAtLocal: "2026-10-18T18:00",
      sourceCardId: "card-9",
      enabled: true,
    });
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(saved.value.title).toBe("Edited pop-up title");
      expect(saved.value.expiresAt).toBe("2026-10-19T01:00:00.000Z");
      expect(saved.value.sourceCardId).toBe("card-9");
    }
  });
});
