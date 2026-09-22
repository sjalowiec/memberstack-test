import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("videos/[id] phase-1 English transcript", () => {
  const page = readFileSync(join(process.cwd(), "src", "pages", "videos", "[id].astro"), "utf8");
  const printCss = readFileSync(join(process.cwd(), "src", "styles", "print.css"), "utf8");

  it("loads a readable transcript by Vimeo id and reuses Transcript.astro", () => {
    expect(page).toContain('from "../../lib/transcripts/englishTranscript"');
    expect(page).toContain('from "../../components/media/Transcript.astro"');
    expect(page).toContain("readableEnglishTranscriptForVimeoId");
    expect(page).toContain("englishTranscriptParagraphs");
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
  });

  it("forces closed transcript details to print and hides the player", () => {
    expect(page).toContain("video-english-transcript-print");
    expect(printCss).toContain("details.kbm-transcript");
    expect(printCss).toContain(".video-english-transcript-print");
    expect(printCss).toContain(".kbm-video");
    expect(printCss).toContain("player.vimeo.com");
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
    expect(transcript).not.toContain("kbm-transcript-icon");
    expect(transcript).not.toContain('viewBox="0 0 24 24"');
    expect(css).toContain(".kbm-transcript-caret");
    expect(css).toContain("rotate(45deg)");
    expect(css).toContain("rotate(-135deg)");
  });
});
