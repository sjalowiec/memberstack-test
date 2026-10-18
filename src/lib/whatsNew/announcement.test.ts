import { describe, expect, it } from "vitest";

import {
  announcementToShow,
  isWhatsNewAnnouncementEligible,
  selectWhatsNewAnnouncements,
  WHATS_NEW_ANNOUNCEMENT_NOTE,
  whatsNewEntryHref,
} from "./announcement";
import type { WhatsNewCard } from "./types";

const today = "2026-08-01";

function card(overrides: Partial<WhatsNewCard> = {}): WhatsNewCard {
  return {
    id: "card-1",
    title: "A clearer cast on",
    description: "<p>A short introduction.</p>",
    category: "learning",
    categoryLabel: "Learning",
    destinationUrl: "/learn",
    buttonText: "Start Learning",
    boardColumn: "just_added",
    publishDate: "2026-07-20",
    featured: false,
    status: "published",
    displayOrder: 0,
    archived: false,
    popupEnabled: true,
    popupAudience: "everyone",
    popupExpiresOn: null,
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    isNew: true,
    ...overrides,
  };
}

describe("What's New popup announcements", () => {
  it("links Read more to the full What's New entry", () => {
    expect(whatsNewEntryHref("card-1")).toBe("/whats-new#whats-new-entry-card-1");
    expect(WHATS_NEW_ANNOUNCEMENT_NOTE).toContain("What’s New");
  });

  it("shows only a published, unexpired popup", () => {
    expect(isWhatsNewAnnouncementEligible(card(), today)).toBe(true);
    expect(isWhatsNewAnnouncementEligible(card({ status: "draft" }), today)).toBe(false);
    expect(isWhatsNewAnnouncementEligible(card({ archived: true }), today)).toBe(false);
    expect(isWhatsNewAnnouncementEligible(card({ popupEnabled: false }), today)).toBe(false);
    expect(isWhatsNewAnnouncementEligible(card({ publishDate: "2026-08-02" }), today)).toBe(false);
    expect(isWhatsNewAnnouncementEligible(card({ popupExpiresOn: "2026-07-31" }), today)).toBe(false);
    expect(isWhatsNewAnnouncementEligible(card({ popupExpiresOn: today }), today)).toBe(true);
  });

  it("returns one current announcement and does not offer a backlog", () => {
    const older = card({
      id: "older",
      title: "Older",
      publishDate: "2026-07-01",
      updatedAt: "2026-07-01T00:00:00.000Z",
    });
    const newer = card({
      id: "newer",
      title: "Newer",
      publishDate: "2026-07-20",
      updatedAt: "2026-07-20T00:00:00.000Z",
    });
    const membersOnly = card({
      id: "members",
      title: "Members",
      publishDate: "2026-07-28",
      popupAudience: "members",
      updatedAt: "2026-07-28T00:00:00.000Z",
    });
    const choice = selectWhatsNewAnnouncements([older, newer, membersOnly], today);

    expect(choice.everyone?.id).toBe("newer");
    expect(choice.members?.id).toBe("members");
    const everyone = choice.everyone;
    const members = choice.members;
    expect(announcementToShow(everyone, false, () => false)?.id).toBe("newer");
    expect(announcementToShow(members, true, () => false)?.id).toBe("members");
    expect(announcementToShow(members, false, () => false)).toBeNull();
    expect(announcementToShow(members, true, (id) => id === "members")).toBeNull();
    expect(announcementToShow(everyone, true, (id) => id === "older")?.id).toBe("newer");
  });
});
