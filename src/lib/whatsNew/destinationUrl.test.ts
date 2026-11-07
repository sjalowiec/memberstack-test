import { describe, expect, it } from "vitest";

import {
  acceptsWhatsNewAnnouncementHref,
  normalizeWhatsNewDestinationUrl,
} from "./destinationUrl";

describe("normalizeWhatsNewDestinationUrl", () => {
  it("accepts site-relative paths", () => {
    expect(normalizeWhatsNewDestinationUrl("/tools/slope")).toEqual({
      ok: true,
      value: "/tools/slope",
    });
  });

  it("accepts absolute https URLs", () => {
    const result = normalizeWhatsNewDestinationUrl("https://knititnow.com/tools");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("https://knititnow.com/tools");
    }
  });

  it("treats empty as null", () => {
    expect(normalizeWhatsNewDestinationUrl("")).toEqual({ ok: true, value: null });
    expect(normalizeWhatsNewDestinationUrl("   ")).toEqual({ ok: true, value: null });
    expect(normalizeWhatsNewDestinationUrl(null)).toEqual({ ok: true, value: null });
  });

  it("accepts a normalized announcement href and rejects an unsafe one", () => {
    expect(acceptsWhatsNewAnnouncementHref("/testimonials")).toBe(true);
    expect(acceptsWhatsNewAnnouncementHref("/whats-new#whats-new-entry-card-1")).toBe(true);
    expect(acceptsWhatsNewAnnouncementHref("https://knititnow.com/testimonials")).toBe(true);
    expect(acceptsWhatsNewAnnouncementHref("javascript:alert(1)")).toBe(false);
    expect(acceptsWhatsNewAnnouncementHref("//evil.example/testimonials")).toBe(false);
    expect(acceptsWhatsNewAnnouncementHref("")).toBe(false);
  });

  it("rejects javascript, protocol-relative, html, http, and malformed values", () => {
    expect(normalizeWhatsNewDestinationUrl("javascript:alert(1)").ok).toBe(false);
    expect(normalizeWhatsNewDestinationUrl("//evil.example/path").ok).toBe(false);
    expect(normalizeWhatsNewDestinationUrl("<iframe src='https://x'></iframe>").ok).toBe(false);
    expect(normalizeWhatsNewDestinationUrl("http://example.com").ok).toBe(false);
    expect(normalizeWhatsNewDestinationUrl("not a url").ok).toBe(false);
    expect(normalizeWhatsNewDestinationUrl("/path with spaces").ok).toBe(false);
  });
});
