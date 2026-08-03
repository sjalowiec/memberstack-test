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

  const baseCard = {
    title: "Title",
    category: "tool" as const,
    boardColumn: "just_added" as const,
  };

  it("normalizes plain-text descriptions into safe paragraph markup", () => {
    const result = validateWhatsNewCardInput(
      { ...baseCard, description: "A short update" },
      now,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.description).toBe("<p>A short update</p>");
    }
  });

  it("sanitizes rich description HTML and strips links, scripts, and unsupported tags", () => {
    const result = validateWhatsNewCardInput(
      {
        ...baseCard,
        description:
          '<p><b>Bold</b> <i>italic</i> <a href="/tools">Tools</a><script>x</script></p><ul><li>One</li></ul>',
      },
      now,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.description).toBe(
        "<p><strong>Bold</strong> <em>italic</em> Tools</p><ul><li>One</li></ul>",
      );
    }
  });

  it("rejects descriptions with no visible text", () => {
    expect(validateWhatsNewCardInput({ ...baseCard, description: "   " }, now).ok).toBe(false);
    expect(
      validateWhatsNewCardInput({ ...baseCard, description: "<p><br></p>" }, now).ok,
    ).toBe(false);
    expect(
      validateWhatsNewCardInput(
        { ...baseCard, description: "<script>alert(1)</script>" },
        now,
      ).ok,
    ).toBe(false);
  });

  it("survives a create then edit round trip without changing sanitized markup", () => {
    const created = validateWhatsNewCardInput(
      { ...baseCard, description: "<p><strong>Saved</strong> update</p><ol><li>Step</li></ol>" },
      now,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    // Feeding the stored value back through validation (an edit) is idempotent.
    const edited = validateWhatsNewCardInput(
      { ...baseCard, description: created.value.description },
      now,
    );
    expect(edited.ok).toBe(true);
    if (edited.ok) {
      expect(edited.value.description).toBe(created.value.description);
      expect(edited.value.description).toBe(
        "<p><strong>Saved</strong> update</p><ol><li>Step</li></ol>",
      );
    }
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
