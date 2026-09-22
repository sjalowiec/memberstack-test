import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  englishTranscriptParagraphs,
  indexEnglishTranscriptSources,
  readableEnglishTranscriptForVimeoId,
  vimeoIdFromTranscriptFilename,
} from "./englishTranscript";
import { parseVttToReadableText } from "./parseVtt";

describe("vimeoIdFromTranscriptFilename", () => {
  it("extracts the numeric id from _EN, _en, and bare .vtt names", () => {
    expect(vimeoIdFromTranscriptFilename("1046394794.vtt")).toBe("1046394794");
    expect(vimeoIdFromTranscriptFilename("1046394794_EN.vtt")).toBe("1046394794");
    expect(vimeoIdFromTranscriptFilename("1046394794_en.vtt")).toBe("1046394794");
    expect(vimeoIdFromTranscriptFilename("src/data/transcripts/en/151857129_en.vtt")).toBe(
      "151857129",
    );
  });

  it("rejects non-english or malformed names", () => {
    expect(vimeoIdFromTranscriptFilename("1046394794_es.vtt")).toBeNull();
    expect(vimeoIdFromTranscriptFilename("HS_test.vtt")).toBeNull();
    expect(vimeoIdFromTranscriptFilename("")).toBeNull();
  });
});

describe("readableEnglishTranscriptForVimeoId", () => {
  const sources = {
    "src/data/transcripts/en/1046394794.vtt": `WEBVTT

00:00:01.000 --> 00:00:03.000
Hello from the swatch video.
`,
    "src/data/transcripts/en/111_en.vtt": `WEBVTT

00:00:01.000 --> 00:00:02.000
Lowercase suffix file.
`,
  };

  it("returns readable text for a matching vimeo id", () => {
    expect(readableEnglishTranscriptForVimeoId("1046394794", sources)).toBe(
      "Hello from the swatch video.",
    );
    expect(readableEnglishTranscriptForVimeoId(111, sources)).toBe("Lowercase suffix file.");
  });

  it("returns null when no file exists for that vimeo id", () => {
    expect(readableEnglishTranscriptForVimeoId("999999999", sources)).toBeNull();
    expect(readableEnglishTranscriptForVimeoId("", sources)).toBeNull();
    expect(readableEnglishTranscriptForVimeoId(null, sources)).toBeNull();
  });

  it("prefers the longer source when the same id appears twice", () => {
    const map = indexEnglishTranscriptSources({
      "a/379811875_en.vtt": "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nShort.\n",
      "a/379811875_en-US.vtt":
        "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nThis is the longer spoken line.\n",
    });
    expect(readableEnglishTranscriptForVimeoId("379811875", map)).toBe(
      "This is the longer spoken line.",
    );
  });
});

describe("englishTranscriptParagraphs", () => {
  it("splits readable text on blank lines", () => {
    expect(englishTranscriptParagraphs("One.\n\nTwo three.")).toEqual(["One.", "Two three."]);
    expect(englishTranscriptParagraphs(null)).toEqual([]);
  });
});

describe("bundled 1046394794.vtt", () => {
  const vttPath = join(process.cwd(), "src", "data", "transcripts", "en", "1046394794.vtt");
  const raw = readFileSync(vttPath, "utf8");

  it("parses the copied swatch VTT into spoken text without captions chrome", () => {
    const text = parseVttToReadableText(raw);
    expect(text).toBeTruthy();
    expect(text).toContain("Knitting a proper swatch is the key to success with your knitting machine.");
    expect(text).toContain("Follow along as I knit a swatch.");
    expect(text).not.toMatch(/WEBVTT/);
    expect(text).not.toMatch(/\d{2}:\d{2}:\d{2}\.\d{3}/);
  });

  it("is what lookup finds for Vimeo 1046394794", () => {
    const fromFile = parseVttToReadableText(raw);
    expect(readableEnglishTranscriptForVimeoId("1046394794")).toBe(fromFile);
    expect(readableEnglishTranscriptForVimeoId("999999999")).toBeNull();
  });
});

describe("bundled 151857129.vtt", () => {
  const vttPath = join(process.cwd(), "src", "data", "transcripts", "en", "151857129.vtt");
  const raw = readFileSync(vttPath, "utf8");

  it("parses the I-Cord VTT into spoken text without captions chrome", () => {
    const text = parseVttToReadableText(raw);
    expect(text).toBeTruthy();
    expect(text).toContain("Begin by casting on three stitches.");
    expect(text).toContain("Designer your machine to slip in one direction.");
    expect(text).not.toMatch(/WEBVTT/);
    expect(text).not.toMatch(/\d{2}:\d{2}:\d{2}\.\d{3}/);
  });

  it("is what lookup finds for Vimeo 151857129", () => {
    const fromFile = parseVttToReadableText(raw);
    expect(readableEnglishTranscriptForVimeoId("151857129")).toBe(fromFile);
  });
});
