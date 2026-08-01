import { describe, expect, it } from "vitest";

import {
  billboardHasButton,
  billboardHasVideo,
  getPublicBillboard,
  losAngelesCalendarDate,
} from "./billboard";
import type { WhatsNewBillboardSettings } from "./types";

function settings(
  overrides: Partial<WhatsNewBillboardSettings> = {},
): WhatsNewBillboardSettings {
  return {
    key: "featured_video",
    headline: "Spring tip",
    message: "Try this helpful tip today.",
    originalVideoUrl: null,
    safeVimeoEmbedUrl: null,
    buttonText: null,
    buttonDestinationUrl: null,
    startDate: null,
    endDate: null,
    publishDate: null,
    enabled: true,
    updatedAt: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("whatsNew billboard visibility", () => {
  const now = new Date("2026-08-01T19:00:00.000Z"); // afternoon LA on Aug 1

  it("renders text-only billboards when enabled", () => {
    const publicBillboard = getPublicBillboard(settings(), now);
    expect(publicBillboard?.headline).toBe("Spring tip");
    expect(publicBillboard?.message).toBe("<p>Try this helpful tip today.</p>");
    expect(billboardHasVideo(publicBillboard!)).toBe(false);
    expect(billboardHasButton(publicBillboard!)).toBe(false);
  });

  it("sanitizes public billboard HTML and keeps plain-text compatibility", () => {
    const withHtml = getPublicBillboard(
      settings({
        message: '<p>Hi <b>there</b><script>alert(1)</script></p>',
      }),
      now,
    );
    expect(withHtml?.message).toBe("<p>Hi <strong>there</strong></p>");

    const withUnsafeLink = getPublicBillboard(
      settings({
        message: '<p><a href="javascript:alert(1)">Nope</a> ok</p>',
      }),
      now,
    );
    expect(withUnsafeLink?.message).toBe("<p>Nope ok</p>");
  });

  it("keeps text+CTA and text+video layouts compatible with rich messages", () => {
    const withCtaAndRich = getPublicBillboard(
      settings({
        message: "<p>Limited <em>time</em></p>",
        buttonText: "Explore tools",
        buttonDestinationUrl: "/tools",
      }),
      now,
    );
    expect(withCtaAndRich?.message).toContain("<em>time</em>");
    expect(billboardHasButton(withCtaAndRich!)).toBe(true);
    expect(billboardHasVideo(withCtaAndRich!)).toBe(false);

    const withVideoAndRich = getPublicBillboard(
      settings({
        message: "<ul><li>Tip</li></ul>",
        originalVideoUrl: "https://vimeo.com/123456789",
        safeVimeoEmbedUrl: "https://player.vimeo.com/video/123456789",
      }),
      now,
    );
    expect(withVideoAndRich?.message).toBe("<ul><li>Tip</li></ul>");
    expect(billboardHasVideo(withVideoAndRich!)).toBe(true);
  });

  it("keeps CTA only when both button text and destination exist", () => {
    const withCta = getPublicBillboard(
      settings({
        buttonText: "Explore tools",
        buttonDestinationUrl: "/tools",
      }),
      now,
    );
    expect(billboardHasButton(withCta!)).toBe(true);

    const textOnlyButton = getPublicBillboard(
      settings({ buttonText: "Explore tools", buttonDestinationUrl: null }),
      now,
    );
    expect(billboardHasButton(textOnlyButton!)).toBe(false);
  });

  it("keeps Vimeo when a safe embed URL is present", () => {
    const withVideo = getPublicBillboard(
      settings({
        originalVideoUrl: "https://vimeo.com/123456789",
        safeVimeoEmbedUrl: "https://player.vimeo.com/video/123456789",
      }),
      now,
    );
    expect(billboardHasVideo(withVideo!)).toBe(true);
    expect(withVideo?.safeVimeoEmbedUrl).toContain("player.vimeo.com");
  });

  it("hides disabled billboards", () => {
    expect(getPublicBillboard(settings({ enabled: false }), now)).toBeNull();
  });

  it("hides billboards before the start date in America/Los_Angeles", () => {
    expect(
      getPublicBillboard(settings({ startDate: "2026-08-02" }), now),
    ).toBeNull();
    expect(
      getPublicBillboard(settings({ startDate: "2026-08-01" }), now),
    ).not.toBeNull();
  });

  it("hides billboards after the end date in America/Los_Angeles", () => {
    expect(
      getPublicBillboard(settings({ endDate: "2026-07-31" }), now),
    ).toBeNull();
    expect(
      getPublicBillboard(settings({ endDate: "2026-08-01" }), now),
    ).not.toBeNull();
  });

  it("formats LA calendar dates as YYYY-MM-DD", () => {
    expect(losAngelesCalendarDate(now)).toBe("2026-08-01");
  });
});
