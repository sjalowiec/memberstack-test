import { describe, expect, it } from "vitest";
import {
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

  it("formats a single-video success message", () => {
    const titles = new Map([["785", "Ravel Cord Tips"]]);
    expect(describeVideoAccessPatchSuccess([{ content_id: 785, access_level: "public" }], titles)).toBe(
      "Saved access level for 785 - Ravel Cord Tips (public).",
    );
  });
});
