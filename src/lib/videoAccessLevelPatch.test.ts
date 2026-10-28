import { describe, expect, it } from "vitest";
import {
  accessLevelsMatchCatalog,
  applyVideoAccessLevelPatches,
  describeVideoAccessPatchSuccess,
} from "./videoAccessLevelPatch";

describe("videoAccessLevelPatch", () => {
  it("patches access_level by content_id without changing other fields", () => {
    const videos = [
      { content_id: 785, slug: "ravel-cord-tips", title: "Ravel Cord Tips", access_level: "member", vimeo_id: 1 },
      { content_id: 786, slug: "other", title: "Other", access_level: "member", vimeo_id: 2 },
    ];

    const result = applyVideoAccessLevelPatches(videos, [{ content_id: 785, access_level: "public" }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(videos[0]).toMatchObject({
      content_id: 785,
      title: "Ravel Cord Tips",
      access_level: "public",
      vimeo_id: 1,
    });
    expect(videos[1]?.access_level).toBe("member");
  });

  it("confirms a write only when the catalog row has the saved access level", () => {
    const videos = [
      { content_id: 2141, access_level: "public" },
      { content_id: 643, access_level: "member" },
    ];
    expect(accessLevelsMatchCatalog(videos, [{ content_id: 2141, access_level: "public" }])).toBe(true);
    expect(accessLevelsMatchCatalog(videos, [{ content_id: 2141, access_level: "member" }])).toBe(false);
    expect(accessLevelsMatchCatalog(videos, [{ content_id: 643, access_level: "public" }])).toBe(false);
  });

  it("formats a single-video success message", () => {
    const titles = new Map([["785", "Ravel Cord Tips"]]);
    expect(describeVideoAccessPatchSuccess([{ content_id: 785, access_level: "public" }], titles)).toBe(
      "Saved access level for 785 - Ravel Cord Tips (public).",
    );
  });
});
