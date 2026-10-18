import { describe, expect, it } from "vitest";

import { buildWhatsNewAnnouncementActivityEvent } from "./announcementActivity";

describe("What's New announcement activity", () => {
  it("records a display for a verified member and ignores a client-supplied member id", () => {
    const recorded = buildWhatsNewAnnouncementActivityEvent(
      {
        cardId: "card-1",
        eventType: "displayed",
        identity: "guest",
        sourcePage: "/tools/slope?ref=popup",
      },
      { verifiedMemberId: "mem_abc123", now: "2026-08-01T12:00:00.000Z" },
    );
    expect(recorded.ok).toBe(true);
    if (recorded.ok) {
      expect(recorded.event.eventType).toBe("displayed");
      expect(recorded.event.identity).toBe("member");
      expect(recorded.event.memberId).toBe("mem_abc123");
      expect(recorded.event.sourcePage).toBe("/tools/slope");
    }

    const untrusted = buildWhatsNewAnnouncementActivityEvent(
      { cardId: "card-1", eventType: "read_more", identity: "member" },
      { verifiedMemberId: null },
    );
    expect(untrusted.ok).toBe(true);
    if (untrusted.ok) {
      expect(untrusted.event.identity).not.toBe("member");
      expect(untrusted.event.memberId).toBeUndefined();
    }
  });

  it("rejects an unknown event", () => {
    expect(
      buildWhatsNewAnnouncementActivityEvent({ cardId: "card-1", eventType: "dismissed" }).ok,
    ).toBe(false);
  });
});
