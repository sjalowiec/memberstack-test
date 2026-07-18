import { describe, expect, it } from "vitest";
import {
  ACCOUNT_FAVORITES_PREVIEW_LIMIT,
  formatFavoriteGroupHeading,
  selectFavoritePreviewIds,
  sortFavoriteIdsByTitle,
} from "./accountFavoritesPreview";

describe("selectFavoritePreviewIds", () => {
  it("returns newest favorites first, capped at the preview limit", () => {
    const ids = selectFavoritePreviewIds(
      [
        { content_id: "v1", created_at: "2026-01-01T00:00:00.000Z" },
        { content_id: "v2", created_at: "2026-01-05T00:00:00.000Z" },
        { content_id: "v3", created_at: "2026-01-03T00:00:00.000Z" },
        { content_id: "v4", created_at: "2026-01-04T00:00:00.000Z" },
        { content_id: "v5", created_at: "2026-01-02T00:00:00.000Z" },
        { content_id: "v6", created_at: "2026-01-06T00:00:00.000Z" },
      ],
      ACCOUNT_FAVORITES_PREVIEW_LIMIT,
    );

    expect(ids).toEqual(["v6", "v2", "v4", "v3", "v5"]);
  });

  it("returns an empty list when there are no favorites", () => {
    expect(selectFavoritePreviewIds([])).toEqual([]);
  });
});

describe("formatFavoriteGroupHeading", () => {
  it("includes the count in parentheses", () => {
    expect(formatFavoriteGroupHeading("Videos", 3)).toBe("Videos (3)");
    expect(formatFavoriteGroupHeading("Stitches", 1)).toBe("Stitches (1)");
    expect(formatFavoriteGroupHeading("Tools", 0)).toBe("Tools (0)");
  });
});

describe("sortFavoriteIdsByTitle", () => {
  it("sorts by resolved display title, not content id", () => {
    const titles: Record<string, string> = {
      "10": "Zebra stitch",
      "2": "apple cable",
      "3": "Mittens tip",
    };
    expect(sortFavoriteIdsByTitle(["10", "2", "3"], (id) => titles[id] || id)).toEqual([
      "2",
      "3",
      "10",
    ]);
  });

  it("breaks ties with content id", () => {
    expect(sortFavoriteIdsByTitle(["b", "a"], () => "Same")).toEqual(["a", "b"]);
  });
});
