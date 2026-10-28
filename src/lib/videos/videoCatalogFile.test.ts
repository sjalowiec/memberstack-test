import { describe, expect, it } from "vitest";
import {
  HOSTED_ACCESS_LEVEL_SAVE_ERROR,
  HOSTED_CATALOG_SAVE_ERROR,
  patchCatalogAccessLevelText,
  updateCatalogText,
  videoCatalogFileSaveBlocker,
} from "./videoCatalogFile";

const nl = "\r\n";
const kept = `{${nl}    "content_id": 706,${nl}    "slug": "kept",${nl}    "title": "Kept",${nl}    "vimeo_id": 11${nl}  }`;
const edited = `{${nl}    "content_id": 707,${nl}    "slug": "edited",${nl}    "title": "Original",${nl}    "vimeo_id": 22${nl}  }`;
const raw = `[${nl}  ${kept},${nl}  ${nl}  ${edited}${nl}]${nl}`;

const source = [
  { content_id: 706, slug: "kept", title: "Kept", vimeo_id: 11 },
  { content_id: 707, slug: "edited", title: "Original", vimeo_id: 22 },
];

describe("updateCatalogText", () => {
  it("rewrites only the edited record and preserves the other record's bytes", () => {
    const next = updateCatalogText(raw, source, [
      source[0],
      { ...source[1], title: "Renamed", slug: "edited", vimeo_id: 22 },
    ]);
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.updated).toEqual(["707"]);
    expect(next.added).toEqual([]);
    expect(next.deleted).toEqual([]);
    expect(next.text).toContain(kept);
    expect(next.text).toContain('"title": "Renamed"');
    expect(next.text).not.toContain('"title": "Original"');
    expect(next.text).not.toContain("search_ready");
    expect(next.text).toContain(`${kept},${nl}  ${nl}  `);
  });

  it("appends a new video without rewriting existing records", () => {
    const next = updateCatalogText(raw, source, [
      ...source,
      { content_id: 990707, slug: "new-video", title: "New", vimeo_id: 33 },
    ]);
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.added).toEqual(["990707"]);
    expect(next.text.startsWith(`[${nl}  ${kept},${nl}  ${nl}  ${edited},${nl}  `)).toBe(true);
    expect(next.text).toContain('"content_id": 990707');
    expect(next.text.endsWith(`${nl}]${nl}`)).toBe(true);
  });

  it("removes one video and leaves the remaining record unchanged", () => {
    const next = updateCatalogText(raw, source, [source[0]]);
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.deleted).toEqual(["707"]);
    expect(next.text).toContain(kept);
    expect(next.text).not.toContain("707");
  });

  it("refuses a save that would remove more than one video", () => {
    const next = updateCatalogText(raw, source, []);
    expect(next.ok).toBe(false);
    if (next.ok) return;
    expect(next.error).toContain("remove 2 videos");
  });

  it("changes a video number in place", () => {
    const next = updateCatalogText(raw, source, [source[0], { ...source[1], content_id: 708 }]);
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.updated).toEqual(["708"]);
    expect(next.deleted).toEqual([]);
    expect(next.text).toContain(kept);
    expect(next.text).toContain('"content_id": 708');
  });
});

describe("patchCatalogAccessLevelText", () => {
  it("changes one access_level and keeps every other byte, including blank lines", () => {
    const kept = `{${nl}    "content_id": 643,${nl}    "title": "Adding Bust Darts",${nl}    "access_level": "member"${nl}  }`;
    const edited = `{${nl}    "content_id": 2141,${nl}    "slug": "lk150-replace-the-sponge",${nl}    "title": "Lk150 Replace the Sponge",${nl}    "access_level": "member"${nl}  }`;
    const raw = `[${nl}  ${kept},${nl}  ${nl}  ${edited}${nl}]${nl}`;
    const next = patchCatalogAccessLevelText(raw, [{ content_id: 2141, access_level: "public" }]);
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.text).toBe(
      `[${nl}  ${kept},${nl}  ${nl}  ${edited.replace('"access_level": "member"', '"access_level": "public"')}${nl}]${nl}`,
    );
    expect(next.text).toContain(kept);
    expect(next.text).toContain(`${kept},${nl}  ${nl}  `);
  });
});

describe("videoCatalogFileSaveBlocker", () => {
  it("blocks hosted Netlify, including kin-dev, and allows local dev", () => {
    expect(videoCatalogFileSaveBlocker({ NETLIFY: "true" })).toBe(HOSTED_CATALOG_SAVE_ERROR);
    expect(videoCatalogFileSaveBlocker({ NETLIFY: "true", NETLIFY_DEV: "true" })).toBeNull();
    expect(videoCatalogFileSaveBlocker({})).toBeNull();
    expect(HOSTED_ACCESS_LEVEL_SAVE_ERROR).toContain("src/data/videos-public.json");
    expect(HOSTED_ACCESS_LEVEL_SAVE_ERROR).toContain("Nothing was saved");
  });
});
