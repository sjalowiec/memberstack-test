import { describe, expect, it } from "vitest";

import {
  hasSeenAnnouncement,
  mergeAnnouncementSeenIntoMemberJson,
  readSeenMapFromMemberJson,
  WHATS_NEW_ANNOUNCEMENT_SEEN_KEY,
} from "./announcementSeen";

describe("What's New announcement seen state", () => {
  it("records a seen announcement in account JSON without dropping other fields", () => {
    const merged = mergeAnnouncementSeenIntoMemberJson(
      {
        data: {
          freePatternClaim: { sleeveless: "pattern-1" },
          [WHATS_NEW_ANNOUNCEMENT_SEEN_KEY]: { older: "2026-07-01T00:00:00.000Z" },
        },
      },
      "card-2",
      "2026-08-01T12:00:00.000Z",
    );

    expect(merged.freePatternClaim).toEqual({ sleeveless: "pattern-1" });
    expect(merged[WHATS_NEW_ANNOUNCEMENT_SEEN_KEY]).toEqual({
      older: "2026-07-01T00:00:00.000Z",
      "card-2": "2026-08-01T12:00:00.000Z",
    });
    expect(hasSeenAnnouncement(readSeenMapFromMemberJson({ data: merged }), "card-2")).toBe(true);
    expect(hasSeenAnnouncement(readSeenMapFromMemberJson({ data: merged }), "missing")).toBe(false);
  });
});
