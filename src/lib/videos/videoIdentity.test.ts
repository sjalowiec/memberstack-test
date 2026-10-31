import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import videos from "../../data/videos-public.json";
import {
  assignNewVideoContentIds,
  catalogSlugSaveError,
  NEW_VIDEO_CONTENT_ID_FLOOR,
  nextVideoContentId,
  slugFieldValue,
  suggestedVideoSlug,
  videoSlugDraftError,
} from "./videoIdentity";

const catalog = videos as Array<{ content_id: string | number; slug?: string; title?: string }>;

const neckbandTitle = "How Many Stitches Should I Pick Up for a Neckband?";
const neckbandSlug = "how-many-stitches-to-pick-up-for-a-neckband";

describe("nextVideoContentId", () => {
  it("starts at 5001 when the catalog is empty so legacy numbers stay unused", () => {
    expect(nextVideoContentId([])).toBe(NEW_VIDEO_CONTENT_ID_FLOOR + 1);
    expect(nextVideoContentId([10, 2216, "249", "249-1", "249-2"])).toBe(5001);
  });

  it("continues after the current catalog without reusing 5001, 5002, or a clip id", () => {
    const next = nextVideoContentId(catalog.map((video) => video.content_id));
    expect(next).toBe(5003);
    expect(catalog.some((video) => String(video.content_id) === String(next))).toBe(false);
  });

  it("skips a reserved id above the highest number", () => {
    expect(nextVideoContentId([5002, "5003"])).toBe(5004);
  });
});

describe("assignNewVideoContentIds", () => {
  const source = [
    { content_id: 706, slug: "kept" },
    { content_id: "249", slug: "introduction-to-cut-and-sew" },
    { content_id: "249-1", slug: "cut-and-sew-cutting" },
    { content_id: 5002, slug: "bind-off-trick" },
  ];

  it("assigns the next id when Content ID is empty and preserves legacy ids", () => {
    const assigned = assignNewVideoContentIds(source, [
      ...source,
      { slug: "new-video", title: "New" },
    ]);
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) return;
    expect(assigned.videos[1]?.content_id).toBe("249");
    expect(assigned.videos[2]?.content_id).toBe("249-1");
    expect(assigned.videos[4]?.content_id).toBe(5003);
  });

  it("rejects a Content ID the browser invented for a new video", () => {
    const assigned = assignNewVideoContentIds(source, [...source, { content_id: 990707, slug: "new-video" }]);
    expect(assigned.ok).toBe(false);
    if (assigned.ok) return;
    expect(assigned.error).toContain("Leave Content ID empty");
  });

  it("gives two new videos different ids", () => {
    const assigned = assignNewVideoContentIds(source, [
      ...source,
      { slug: "one" },
      { slug: "two" },
    ]);
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) return;
    expect(assigned.videos[4]?.content_id).toBe(5003);
    expect(assigned.videos[5]?.content_id).toBe(5004);
  });
});

describe("video slugs", () => {
  it("suggests a slug from the title and leaves a hand-edited or existing slug alone", () => {
    expect(suggestedVideoSlug(neckbandTitle)).toBe("how-many-stitches-should-i-pick-up-for-a-neckband");
    expect(
      slugFieldValue({ isNew: true, slugEdited: false, title: neckbandTitle, currentSlug: "" }),
    ).toBe("how-many-stitches-should-i-pick-up-for-a-neckband");
    expect(
      slugFieldValue({
        isNew: true,
        slugEdited: true,
        title: neckbandTitle,
        currentSlug: neckbandSlug,
      }),
    ).toBe(neckbandSlug);
    expect(
      slugFieldValue({
        isNew: false,
        slugEdited: false,
        title: "Renamed title",
        currentSlug: "v-neck-bands",
      }),
    ).toBe("v-neck-bands");
  });

  it("accepts the neckband slug and rejects a slug that already exists", () => {
    expect(catalog.some((video) => video.slug === neckbandSlug)).toBe(false);
    expect(
      videoSlugDraftError(neckbandSlug, catalog, { isNew: true }),
    ).toBeNull();
    expect(videoSlugDraftError("v-neck-bands", catalog, { isNew: true })).toBe(
      'That slug is already used by "V-Neck Bands".',
    );
    expect(videoSlugDraftError("V-Neck-Bands", catalog, { isNew: true })).toBe(
      "Use lowercase letters, numbers, and hyphens.",
    );
  });

  it("keeps an existing legacy slug and still blocks a duplicate change", () => {
    const legacy = "half-circular-|-u-knitting";
    const legacyRows = [{ content_id: 42, slug: legacy, title: "Legacy" }];
    expect(
      videoSlugDraftError(legacy, legacyRows, { isNew: false, originalSlug: legacy, contentId: 42 }),
    ).toBeNull();
    expect(
      catalogSlugSaveError(
        [{ content_id: 1, slug: legacy }],
        [{ content_id: 1, slug: legacy }],
      ),
    ).toBeNull();
    expect(
      catalogSlugSaveError(catalog, [
        ...catalog,
        { content_id: 5003, slug: "v-neck-bands" },
      ]),
    ).toBe("That slug is already used.");
  });
});

describe("video editor page", () => {
  it("does not calculate the next Content ID in the browser", () => {
    const page = readFileSync(join(process.cwd(), "src", "pages", "admin", "videos-edit.astro"), "utf8");
    expect(page).not.toContain("nextVideoNumber");
    expect(page).not.toContain('name="content_id"');
    expect(page).toContain("slugFieldValue");
    expect(page).toContain("A unique Content ID is assigned when you save.");
  });
});
