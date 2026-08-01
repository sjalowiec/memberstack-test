import { describe, expect, it } from "vitest";

import { normalizeVimeoUrl } from "../videoReplies/vimeoUrl";
import { validateBillboardInput, validateWhatsNewCardInput } from "./validation";

describe("validateWhatsNewCardInput", () => {
  const now = new Date("2026-08-01T12:00:00.000Z");

  it("requires title, description, category, and board column", () => {
    expect(validateWhatsNewCardInput({}, now).ok).toBe(false);
    expect(
      validateWhatsNewCardInput(
        {
          title: "Title",
          description: "Desc",
          category: "tool",
          boardColumn: "just_added",
        },
        now,
      ).ok,
    ).toBe(true);
  });

  it("defaults publish date to today and button text from category when URL present", () => {
    const result = validateWhatsNewCardInput(
      {
        title: "Title",
        description: "Desc",
        category: "pattern",
        boardColumn: "worth_exploring",
        destinationUrl: "/patterns",
      },
      now,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.publishDate).toBe("2026-08-01");
      expect(result.value.buttonText).toBe("View Pattern");
    }
  });

  it("allows button text override", () => {
    const result = validateWhatsNewCardInput(
      {
        title: "Title",
        description: "Desc",
        category: "tool",
        boardColumn: "just_added",
        destinationUrl: "/tools/slope",
        buttonText: "Open Slope",
      },
      now,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.buttonText).toBe("Open Slope");
    }
  });

  it("rejects unsafe destination URLs", () => {
    const result = validateWhatsNewCardInput(
      {
        title: "Title",
        description: "Desc",
        category: "tool",
        boardColumn: "just_added",
        destinationUrl: "javascript:alert(1)",
      },
      now,
    );
    expect(result.ok).toBe(false);
  });
});

describe("validateBillboardInput", () => {
  it("accepts text-only enabled billboards and normalizes plain text", () => {
    const result = validateBillboardInput(
      {
        headline: "Hello",
        message: "A short note",
        enabled: true,
      },
      normalizeVimeoUrl,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.introduction).toBe("<p>A short note</p>");
    }
  });

  it("sanitizes rich message HTML on save", () => {
    const result = validateBillboardInput(
      {
        headline: "Hello",
        message: '<p><b>Bold</b> <a href="/tools">Tools</a><script>x</script></p>',
        enabled: true,
      },
      normalizeVimeoUrl,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.introduction).toBe(
        '<p><strong>Bold</strong> <a href="/tools">Tools</a></p>',
      );
    }
  });

  it("requires headline and message when enabled", () => {
    expect(
      validateBillboardInput({ enabled: true, headline: "", message: "Hi" }, normalizeVimeoUrl)
        .ok,
    ).toBe(false);
    expect(
      validateBillboardInput({ enabled: true, headline: "Hi", message: "" }, normalizeVimeoUrl)
        .ok,
    ).toBe(false);
  });

  it("accepts optional Vimeo and rejects iframe HTML / invalid destinations", () => {
    const withVideo = validateBillboardInput(
      {
        headline: "Watch",
        message: "A tip",
        videoUrl: "https://vimeo.com/123456789",
        enabled: true,
      },
      normalizeVimeoUrl,
    );
    expect(withVideo.ok).toBe(true);
    if (withVideo.ok) {
      expect(withVideo.value.safeVimeoEmbedUrl).toContain("player.vimeo.com/video/123456789");
    }

    expect(
      validateBillboardInput(
        {
          headline: "Watch",
          message: "A tip",
          videoUrl: '<iframe src="https://vimeo.com/1"></iframe>',
          enabled: true,
        },
        normalizeVimeoUrl,
      ).ok,
    ).toBe(false);

    expect(
      validateBillboardInput(
        {
          headline: "Offer",
          message: "Limited time",
          buttonText: "Shop",
          buttonDestinationUrl: "javascript:alert(1)",
          enabled: true,
        },
        normalizeVimeoUrl,
      ).ok,
    ).toBe(false);
  });

  it("requires button text and destination together", () => {
    expect(
      validateBillboardInput(
        {
          headline: "Offer",
          message: "Limited time",
          buttonText: "Shop",
          enabled: true,
        },
        normalizeVimeoUrl,
      ).ok,
    ).toBe(false);
  });

  it("allows disabled billboards without content", () => {
    const result = validateBillboardInput(
      { enabled: false, headline: "", message: "" },
      normalizeVimeoUrl,
    );
    expect(result.ok).toBe(true);
  });
});
