import { describe, expect, it } from "vitest";
import { searchVideos } from "./videoSearch.js";

const videos = [
  {
    vimeoId: "1",
    title: "Shoulders",
    chunks: [
      { start: 1, timestamp: "0:01", text: "Cast off the shoulder stitches." },
      { start: 2, timestamp: "0:02", text: "Check your gauge." },
    ],
  },
  {
    vimeoId: "2",
    title: "Latch tool",
    chunks: [
      { start: 4, timestamp: "0:04", text: "Latch tool bind off gives a neat edge." },
      { start: 8, timestamp: "0:08", text: "Bind off the neckline." },
    ],
  },
];

describe("searchVideos", () => {
  it("returns cast-off wording before bind-off synonyms, once each", () => {
    const results = searchVideos(videos, "cast off");
    expect(results.map((result) => result.text)).toEqual([
      "Cast off the shoulder stitches.",
      "Latch tool bind off gives a neat edge.",
      "Bind off the neckline.",
    ]);
  });

  it("keeps latch tool in the query", () => {
    const results = searchVideos(videos, "latch tool cast off");
    expect(results.map((result) => result.text)).toEqual([
      "Latch tool bind off gives a neat edge.",
    ]);
  });

  it("still matches an unrelated word", () => {
    expect(searchVideos(videos, "gauge").map((result) => result.text)).toEqual([
      "Check your gauge.",
    ]);
  });
});
