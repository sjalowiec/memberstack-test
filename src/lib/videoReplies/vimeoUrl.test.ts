import { describe, expect, it } from "vitest";

import { isValidVimeoUrl, normalizeVimeoUrl } from "./vimeoUrl";

describe("normalizeVimeoUrl", () => {
  it("normalizes a standard Vimeo video URL", () => {
    const result = normalizeVimeoUrl("https://vimeo.com/123456789");
    expect(result).toEqual({
      originalVimeoUrl: "https://vimeo.com/123456789",
      safeVimeoEmbedUrl: "https://player.vimeo.com/video/123456789",
      vimeoId: "123456789",
    });
  });

  it("normalizes player.vimeo.com links", () => {
    const result = normalizeVimeoUrl("https://player.vimeo.com/video/987654321");
    expect(result?.safeVimeoEmbedUrl).toBe("https://player.vimeo.com/video/987654321");
    expect(result?.vimeoId).toBe("987654321");
  });

  it("preserves privacy hash from path", () => {
    const result = normalizeVimeoUrl("https://vimeo.com/123456789/abc123def");
    expect(result?.privacyHash).toBe("abc123def");
    expect(result?.safeVimeoEmbedUrl).toBe(
      "https://player.vimeo.com/video/123456789?h=abc123def",
    );
  });

  it("builds the unlisted catalog player URL for video 1218264661", () => {
    const result = normalizeVimeoUrl("https://vimeo.com/1218264661/b1bc386c3c");
    expect(result?.vimeoId).toBe("1218264661");
    expect(result?.privacyHash).toBe("b1bc386c3c");
    expect(result?.safeVimeoEmbedUrl).toBe(
      "https://player.vimeo.com/video/1218264661?h=b1bc386c3c",
    );
  });

  it("preserves privacy hash from query string", () => {
    const result = normalizeVimeoUrl("https://player.vimeo.com/video/123456789?h=hashvalue");
    expect(result?.privacyHash).toBe("hashvalue");
    expect(result?.safeVimeoEmbedUrl).toBe(
      "https://player.vimeo.com/video/123456789?h=hashvalue",
    );
  });

  it("accepts channel and group URLs", () => {
    expect(normalizeVimeoUrl("https://vimeo.com/channels/staffpicks/12345")?.vimeoId).toBe(
      "12345",
    );
    expect(
      normalizeVimeoUrl("https://vimeo.com/groups/name/videos/54321")?.vimeoId,
    ).toBe("54321");
  });

  it("rejects non-Vimeo hosts and junk", () => {
    expect(normalizeVimeoUrl("https://youtube.com/watch?v=abc")).toBeNull();
    expect(normalizeVimeoUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeVimeoUrl("<iframe src='https://vimeo.com/1'></iframe>")).toBeNull();
    expect(normalizeVimeoUrl("")).toBeNull();
    expect(isValidVimeoUrl("not a url")).toBe(false);
  });

  it("never returns HTML", () => {
    const result = normalizeVimeoUrl("https://vimeo.com/111");
    expect(result?.safeVimeoEmbedUrl).not.toMatch(/</);
    expect(result?.safeVimeoEmbedUrl).toMatch(/^https:\/\/player\.vimeo\.com\/video\//);
  });
});
