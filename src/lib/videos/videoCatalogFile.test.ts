import { describe, expect, it } from "vitest";
import {
  HOSTED_CATALOG_SAVE_ERROR,
  updateCatalogText,
  upsertCatalogRecordText,
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

  it("refuses a save that would remove a video", () => {
    const next = updateCatalogText(raw, source, [source[0]]);
    expect(next.ok).toBe(false);
    if (next.ok) return;
    expect(next.error).toContain("remove or renumber video 707");
  });

  it("refuses to change a video number", () => {
    const next = updateCatalogText(raw, source, [source[0], { ...source[1], content_id: 708 }]);
    expect(next.ok).toBe(false);
    if (next.ok) return;
    expect(next.error).toContain("Video numbers cannot change");
  });
});

describe("upsertCatalogRecordText", () => {
  it("replaces one record by video number and keeps the other record's bytes", () => {
    const next = upsertCatalogRecordText(raw, { content_id: 707, slug: "edited", title: "Renamed", vimeo_id: 22 });
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.added).toBe(false);
    expect(next.text).toContain(`${kept},${nl}  ${nl}  `);
    expect(next.text).toContain('"title": "Renamed"');
    expect(next.text).not.toContain('"title": "Original"');
  });

  it("appends a record whose video number is new", () => {
    const next = upsertCatalogRecordText(raw, { content_id: 708, slug: "new", title: "New", vimeo_id: 33 });
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.added).toBe(true);
    expect(next.text.startsWith(`[${nl}  ${kept},${nl}  ${nl}  ${edited},${nl}  `)).toBe(true);
    expect(next.text.endsWith(`${nl}]${nl}`)).toBe(true);
  });

  it("matches a clip number such as 249-1 as text", () => {
    const clipRaw = `[\n  {\n    "content_id": "249-1",\n    "slug": "clip",\n    "title": "Clip",\n    "vimeo_id": 5\n  }\n]\n`;
    const next = upsertCatalogRecordText(clipRaw, { content_id: "249-1", slug: "clip", title: "Clip two", vimeo_id: 5 });
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.added).toBe(false);
    expect(next.text).toContain('"content_id": "249-1"');
    expect(next.text).toContain('"title": "Clip two"');
  });
});

describe("videoCatalogFileSaveBlocker", () => {
  it("blocks hosted Netlify, including kin-dev, and allows local dev", () => {
    expect(videoCatalogFileSaveBlocker({ NETLIFY: "true" })).toBe(HOSTED_CATALOG_SAVE_ERROR);
    expect(videoCatalogFileSaveBlocker({ NETLIFY: "true", NETLIFY_DEV: "true" })).toBeNull();
    expect(videoCatalogFileSaveBlocker({})).toBeNull();
  });
});
