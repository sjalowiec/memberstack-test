import { describe, expect, it } from "vitest";

import { parseVttToReadableText } from "./parseVtt";

describe("parseVttToReadableText", () => {
  it("returns null for empty, whitespace, and missing input", () => {
    expect(parseVttToReadableText(null)).toBeNull();
    expect(parseVttToReadableText(undefined)).toBeNull();
    expect(parseVttToReadableText("")).toBeNull();
    expect(parseVttToReadableText("   \n\n  ")).toBeNull();
  });

  it("returns null for WEBVTT with no cues", () => {
    expect(parseVttToReadableText("WEBVTT\n\n\n")).toBeNull();
    expect(parseVttToReadableText("WEBVTT\n\n\ndsfsd")).toBeNull();
    expect(parseVttToReadableText("WEBVTT\n\nKey information can go here\n")).toBeNull();
  });

  it("returns null for HTML impersonating a VTT file", () => {
    const html = `<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title></head></html>`;
    expect(parseVttToReadableText(html)).toBeNull();
  });

  it("strips a UTF-8 BOM and the WEBVTT header", () => {
    const raw = "\uFEFFWEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello there.\n";
    expect(parseVttToReadableText(raw)).toBe("Hello there.");
  });

  it("removes cue numbers, timestamps, and joins wrapped cue lines", () => {
    const raw = `WEBVTT

1
00:00:01.360 --> 00:00:06.490
Knitting a proper swatch is the key
to success with your knitting machine.

2
00:00:06.560 --> 00:00:09.050
Follow along as I knit a swatch.
`;
    const text = parseVttToReadableText(raw);
    expect(text).toContain("Knitting a proper swatch is the key to success with your knitting machine.");
    expect(text).toContain("Follow along as I knit a swatch.");
    expect(text).not.toMatch(/WEBVTT/);
    expect(text).not.toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(text).not.toMatch(/^1$/m);
  });

  it("ignores NOTE, STYLE, and REGION blocks", () => {
    const raw = `WEBVTT

STYLE
::cue { color: red; }

NOTE this is a comment

REGION
id:fred width:40%

00:00:01.000 --> 00:00:02.000
Spoken line.
`;
    expect(parseVttToReadableText(raw)).toBe("Spoken line.");
  });

  it("strips caption tags while keeping inner text", () => {
    const raw = `WEBVTT

00:00:01.000 --> 00:00:03.000
The secret is the <b>piece</b> <i>summary</i> print format.
`;
    expect(parseVttToReadableText(raw)).toBe(
      "The secret is the piece summary print format.",
    );
  });

  it("accepts cues when the WEBVTT header is missing", () => {
    const raw = `00:00:01.740 --> 00:00:05.790
Here are two methods for decreasing.
`;
    expect(parseVttToReadableText(raw)).toBe("Here are two methods for decreasing.");
  });

  it("drops consecutive duplicate cues and rolling expansions", () => {
    const raw = `WEBVTT

00:00:01.000 --> 00:00:02.000
Hello this is

00:00:02.000 --> 00:00:04.000
Hello this is a line

00:00:04.000 --> 00:00:05.000
Hello this is a line

00:00:05.000 --> 00:00:06.000
of text.
`;
    expect(parseVttToReadableText(raw)).toBe("Hello this is a line of text.");
  });

  it("concatenates different text that shares a timestamp", () => {
    const raw = `WEBVTT

00:00:10.160 --> 00:00:12.080
We'll start in Standard

00:00:10.160 --> 00:00:12.080
Garment Styling.
`;
    expect(parseVttToReadableText(raw)).toBe("We'll start in Standard Garment Styling.");
  });

  it("skips a duplicate WEBVTT header in the body", () => {
    const raw = `WEBVTT

WEBVTT

00:00:02.720 --> 00:00:05.060
Let's explore the Stitch Symbol Organizer.
`;
    expect(parseVttToReadableText(raw)).toBe("Let's explore the Stitch Symbol Organizer.");
  });

  it("outputs plain text, never raw HTML", () => {
    const raw = `WEBVTT

00:00:01.000 --> 00:00:02.000
Use tension 6+ and transfer.
`;
    const text = parseVttToReadableText(raw);
    expect(text).toBe("Use tension 6+ and transfer.");
    expect(text).not.toMatch(/<[^>]+>/);
  });
});
