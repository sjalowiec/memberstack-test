import { describe, expect, it } from "vitest";

import { normalizeVideoForSave } from "../videosPublicRecord";
import {
  sanitizeVideoDescriptionHtml,
  videoDescriptionDisplayHtml,
  videoDescriptionPlainText,
} from "./videoDescriptionHtml";

const NUMBERED = "<ol><li>Cast on.</li><li>Knit two rows.</li><li>Bind off.</li></ol>";

describe("video description HTML", () => {
  it("leaves existing plain text unchanged, including line breaks", () => {
    expect(sanitizeVideoDescriptionHtml("A short catalog description.")).toBe(
      "A short catalog description.",
    );
    expect(sanitizeVideoDescriptionHtml("Line one\nLine two")).toBe("Line one\nLine two");
    expect(sanitizeVideoDescriptionHtml("Use 2 & 4, and a < b.")).toBe("Use 2 & 4, and a < b.");
    expect(sanitizeVideoDescriptionHtml(sanitizeVideoDescriptionHtml("Keep this sentence."))).toBe(
      "Keep this sentence.",
    );
  });

  it("keeps a numbered list and the other supported formatting", () => {
    const formatted = [
      "<p>Set up the machine.</p>",
      "<p>Work <b>slowly</b> and <i>evenly</i>.<br>Check the needles.</p>",
      NUMBERED,
      '<ul><li>Seam</li><li>Block</li></ul>',
      '<p>See <a href="/videos">the library</a>.</p>',
    ].join("");
    const saved = sanitizeVideoDescriptionHtml(
      `${formatted}<script>alert(1)</script><p onclick="alert(1)"><a href="javascript:alert(1)">Bad</a></p>`,
    );

    expect(saved).toContain("<p>Set up the machine.</p>");
    expect(saved).toContain("<strong>slowly</strong>");
    expect(saved).toContain("<em>evenly</em>");
    expect(saved).toContain("<br>");
    expect(saved).toContain(NUMBERED);
    expect(saved).toContain("<ul><li>Seam</li><li>Block</li></ul>");
    expect(saved).toContain('<a href="/videos">the library</a>');
    expect(saved).not.toContain("script");
    expect(saved).not.toContain("onclick");
    expect(saved).not.toContain("javascript:");
    expect(sanitizeVideoDescriptionHtml(saved)).toBe(saved);
  });

  it("turns editor line breaks into paragraphs before sanitizing", () => {
    expect(sanitizeVideoDescriptionHtml("<div>First line</div><div>Second line</div>")).toBe(
      "<p>First line</p><p>Second line</p>",
    );
  });

  it("shows plain text as readable paragraphs and a numbered list as a list", () => {
    expect(videoDescriptionDisplayHtml("Line one\nLine two")).toBe("<p>Line one<br>Line two</p>");
    expect(videoDescriptionDisplayHtml(NUMBERED)).toBe(NUMBERED);
    expect(videoDescriptionPlainText(NUMBERED)).toBe("Cast on. Knit two rows. Bind off.");
    expect(videoDescriptionPlainText("Use 2 & 4.")).toBe("Use 2 & 4.");
  });

  it("sanitizes the description when a video is saved and keeps plain text", () => {
    const plain = normalizeVideoForSave(
      {
        content_id: 300,
        slug: "free-swatch",
        title: "Free Swatch",
        vimeo_id: 300300,
        description: "A short catalog description.",
      },
      0,
    );
    expect(plain.ok && plain.video.description).toBe("A short catalog description.");

    const list = normalizeVideoForSave(
      {
        content_id: 300,
        slug: "free-swatch",
        title: "Free Swatch",
        vimeo_id: 300300,
        description: `${NUMBERED}<img src="javascript:alert(1)" alt="x">`,
      },
      0,
    );
    expect(list.ok && list.video.description).toBe(NUMBERED);
  });
});
