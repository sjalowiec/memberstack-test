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
});
