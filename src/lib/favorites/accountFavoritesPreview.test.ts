import { describe, expect, it } from "vitest";
import {
  ACCOUNT_FAVORITES_PREVIEW_LIMIT,
  selectFavoritePreviewIds,
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
