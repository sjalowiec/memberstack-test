import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("videos/[id] phase-1 English transcript", () => {
  const page = readFileSync(join(process.cwd(), "src", "pages", "videos", "[id].astro"), "utf8");
  const printCss = readFileSync(join(process.cwd(), "src", "styles", "print.css"), "utf8");

  it("loads a readable transcript by Vimeo id and reuses Transcript.astro", () => {
    expect(page).toContain('from "../../data/transcripts/generated/public.json"');
    expect(page).toContain('from "../../lib/transcripts/catalogTranscriptData"');
    expect(page).toContain("paragraphsForVimeoId");
    expect(page).not.toContain("generated/member");
    expect(page).not.toContain("import.meta.glob");
    expect(page).not.toContain("englishTranscript");
    expect(page).toContain('from "../../components/media/Transcript.astro"');
    expect(page).toContain('data-testid="video-english-transcript"');
  });

  it("does not attach a VTT track to the Vimeo iframe", () => {
    expect(page).not.toMatch(/<track\b/i);
    expect(page).not.toContain("text/vtt");
  });

  it("does not expose a public VTT URL", () => {
    expect(page).not.toMatch(/["'`]\/transcripts\//);
    expect(page).not.toContain("public/transcripts");
    expect(page).not.toContain(".vtt");
    expect(existsSync(join(process.cwd(), "public", "transcripts", "en", "151857129.vtt"))).toBe(
      false,
    );
    expect(existsSync(join(process.cwd(), "public", "151857129.vtt"))).toBe(false);
  });

  it("forces closed transcript details to print and hides the player", () => {
    expect(page).toContain("video-english-transcript-print");
    expect(printCss).toContain("details.kbm-transcript");
    expect(printCss).toContain(".video-english-transcript-print");
    expect(printCss).toContain(".kbm-video");
    expect(printCss).toContain("player.vimeo.com");
  });

  it("prints only the video title and transcript", () => {
    expect(page).toContain("bindTranscriptPrintButton");
    expect(printCss).toContain(".video-detail-wrap .page-title");
    expect(printCss).toContain("background: #ffffff !important");
    expect(printCss).toContain("padding: 0.6in !important");
    expect(printCss).toContain(".video-english-transcript-print p");
    expect(printCss).toContain("margin: 0 0 0.75rem 0 !important");
    expect(printCss).toContain(".video-detail > :not(.video-english-transcript)");
    expect(printCss).toContain("[data-favorite-star]");
    expect(printCss).toContain(".kbm-transcript-print");
    expect(printCss).toContain("header,");
    expect(printCss).toContain("footer,");
    expect(printCss).toContain("nav,");
    const gated = page.match(/data-transcript-source="gated"[\s\S]*?<\/div>/);
    expect(gated?.[0]).not.toContain("Print Transcript");
    expect(gated?.[0]).not.toContain("data-print-transcript");
  });

  it("does not put member transcript text in the page template", () => {
    expect(page).not.toContain("Begin by casting on three stitches");
    expect(page).not.toContain("Designer your machine to slip in one direction");
    expect(page).toContain('data-transcript-source="gated"');
    expect(page).toContain("hydrateGatedTranscript");
    expect(page).toContain("ssrTranscriptSections");
    expect(page).toContain("hasGatedTranscript");
    expect(page).toContain('ms.on("member.logout"');
  });

  it("renders player, then description, then jump links, then transcript", () => {
    const playerAt = page.indexOf("<GatedVimeoEmbed");
    const descriptionAt = page.indexOf('class="video-description"');
    const jumpAt = page.indexOf('class="video-jumplinks"');
    const transcriptAt = page.indexOf('data-testid="video-english-transcript"');
    expect(playerAt).toBeGreaterThan(-1);
    expect(descriptionAt).toBeGreaterThan(playerAt);
    expect(jumpAt).toBeGreaterThan(descriptionAt);
    expect(transcriptAt).toBeGreaterThan(jumpAt);
    expect(page).not.toContain("<h2>Description</h2>");
  });
});

describe("Transcript disclosure control", () => {
  const transcript = readFileSync(
    join(process.cwd(), "src", "components", "media", "Transcript.astro"),
    "utf8",
  );
  const css = readFileSync(join(process.cwd(), "src", "styles", "global.css"), "utf8");

  it("uses a left caret instead of a document icon", () => {
    expect(transcript).toContain('class="kbm-transcript-caret"');
    expect(transcript).toContain("<details");
    expect(transcript).toContain("<summary");
    expect(transcript).toContain("transcriptPrintButtonHtml()");
    expect(transcript.indexOf("transcriptPrintButtonHtml()")).toBeLessThan(
      transcript.indexOf("</summary>"),
    );
    expect(transcript).not.toContain("kbm-transcript-icon");
    expect(transcript).not.toContain('viewBox="0 0 24 24"');
    expect(css).toContain(".kbm-transcript-caret");
    expect(css).toContain(".kbm-transcript-print");
    expect(css).toContain("margin-left: auto");
    expect(css).toContain(".kbm-transcript-print-label");
    expect(css).toContain("rotate(45deg)");
    expect(css).toContain("rotate(-135deg)");
  });
});

describe("gated member transcript paint", () => {
  it("renders Read transcript plus a print copy from authorized paragraphs", async () => {
    const { parseAuthorizedTranscript, renderVideoTranscriptDisclosure } = await import(
      "./videoGatedTranscript"
    );
    const parsed = parseAuthorizedTranscript([
      "Begin by casting on three stitches.",
      { text: "Designer your machine to slip in one direction." },
      "   ",
    ]);
    expect(parsed).toEqual([
      "Begin by casting on three stitches.",
      "Designer your machine to slip in one direction.",
    ]);
    const html = renderVideoTranscriptDisclosure(parsed);
    expect(html).toContain("Read transcript");
    expect(html).toContain('class="kbm-transcript-caret"');
    expect(html).toContain('data-print-transcript');
    expect(html).toContain("Print Transcript");
    expect(html.indexOf("data-print-transcript")).toBeLessThan(html.indexOf("</summary>"));
    expect(html.slice(html.indexOf("video-english-transcript-print"))).not.toContain(
      "data-print-transcript",
    );
    expect(html.slice(html.indexOf("video-english-transcript-print"))).not.toContain("<a ");
    expect(html.slice(html.indexOf("video-english-transcript-print"))).not.toContain("<button");
    expect(html).toContain("video-english-transcript-print");
    expect(html).toContain("Begin by casting on three stitches.");
    expect(html).not.toContain("WEBVTT");
    expect(renderVideoTranscriptDisclosure([])).toBe("");
  });
});
