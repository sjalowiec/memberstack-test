import { describe, expect, it } from "vitest";
import { ARMHOLE_BIND_OFF_TRICK_CONTENT_ID } from "./sleevelessPatternOutput";
import { sleevelessHelpVideoFromCatalog } from "./sleevelessCatalogHelpVideo";

describe("sleevelessHelpVideoFromCatalog", () => {
  it("resolves Bind Off Trick (content_id 5002) with Vimeo id and jump links", () => {
    const meta = sleevelessHelpVideoFromCatalog(ARMHOLE_BIND_OFF_TRICK_CONTENT_ID);
    expect(meta).not.toBeNull();
    expect(meta?.id).toBe("1193552931");
    expect(meta?.title).toBe("Bind Off Trick");
    expect(meta?.jumpLinks).toEqual([
      { label: "The Trick", seconds: 37 },
      { label: "Compare", seconds: 88 },
    ]);
  });
});
