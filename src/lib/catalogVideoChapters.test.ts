import { describe, expect, it } from "vitest";
import { catalogChaptersFromVideoRow } from "./catalogVideoChapters";

describe("catalogChaptersFromVideoRow", () => {
  it("parses valid chapter rows", () => {
    expect(
      catalogChaptersFromVideoRow({
        chapters: [
          { label: "A", time: 13 },
          { label: "B", time: "176" },
        ],
      }),
    ).toEqual([
      { label: "A", time: 13 },
      { label: "B", time: 176 },
    ]);
  });

  it("returns empty for missing or invalid input", () => {
    expect(catalogChaptersFromVideoRow(null)).toEqual([]);
    expect(catalogChaptersFromVideoRow({ chapters: [{ label: "", time: 1 }] })).toEqual([]);
    expect(catalogChaptersFromVideoRow({ chapters: [{ label: "x", time: -1 }] })).toEqual([]);
  });

  it("uses jumpLinks when chapters are absent", () => {
    expect(
      catalogChaptersFromVideoRow({
        jumpLinks: [
          { label: "Overview Steps", time: 15 },
          { label: "Tip!", time: 78 },
        ],
      }),
    ).toEqual([
      { label: "Overview Steps", time: 15 },
      { label: "Tip!", time: 78 },
    ]);
  });

  it("prefers chapters over jumpLinks when both exist", () => {
    expect(
      catalogChaptersFromVideoRow({
        chapters: [{ label: "From chapters", time: 1 }],
        jumpLinks: [{ label: "From jumpLinks", time: 99 }],
      }),
    ).toEqual([{ label: "From chapters", time: 1 }]);
  });
});
