import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readCourseContentFile } from "../legacy_kin/courseContentAdmin";

const COURSE_86_ID = 86;
const ATTR_RE = /(?:src|href|poster|data-image)\s*=\s*["']([^"']*)["']/gi;
const CSS_URL_RE = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
const ASSET_EXT_RE = /\.(?:jpg|jpeg|png|gif|webp|svg|pdf|zip|mp3|mp4|wav|webm|stp)$/i;
const PATH_FIELDS = new Set([
  "src",
  "image",
  "filename",
  "poster",
  "thumbnail",
  "iconSrc",
  "SPOTT_IMAGE",
  "numberedSrc",
]);
const OLD_SITE_ASSET_RE =
  /^https?:\/\/(?:www\.)?knititnow\.com\/(?:challenge|images|downloads|contentlibrary|path|swatches)\//i;

function collectFromHtml(html: string, into: Set<string>): void {
  if (!html) return;
  let match: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((match = ATTR_RE.exec(html))) {
    into.add(match[1]!.split(/[?#]/)[0]!);
  }
  CSS_URL_RE.lastIndex = 0;
  while ((match = CSS_URL_RE.exec(html))) {
    into.add(match[2]!.split(/[?#]/)[0]!);
  }
}

function walk(value: unknown, into: Set<string>, field = ""): void {
  if (value == null) return;
  if (typeof value === "string") {
    if (PATH_FIELDS.has(field)) into.add(value.split(/[?#]/)[0]!);
    collectFromHtml(value, into);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walk(item, into, field);
    return;
  }
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      walk(nested, into, key);
    }
  }
}

function isAssetRef(ref: string): boolean {
  if (!ref) return false;
  if (ref.startsWith("#") || /^(mailto:|javascript:|tel:)/i.test(ref)) return false;
  if (ASSET_EXT_RE.test(ref)) return true;
  return (
    ref.startsWith("/challenge/") ||
    ref.startsWith("/downloads/") ||
    ref.startsWith("/path/") ||
    ref.startsWith("/swatches/") ||
    ref.startsWith("/images/") ||
    ref.startsWith("/contentlibrary/") ||
    OLD_SITE_ASSET_RE.test(ref)
  );
}

function storedAssetRefs(): string[] {
  const poc = readCourseContentFile(COURSE_86_ID);
  const refs = new Set<string>();
  walk(poc, refs);
  return [...refs].filter(isAssetRef);
}

describe("Course 86 stored asset integrity", () => {
  it("has no leftover legacy /challenge/ asset paths in the stored JSON", () => {
    const leftover = storedAssetRefs().filter((ref) => ref.includes("/challenge/"));
    expect(leftover).toEqual([]);
  });

  it("has a public/ file for every referenced /images/ path", () => {
    const missing = storedAssetRefs()
      .filter((ref) => ref.startsWith("/images/"))
      .filter((ref) => !existsSync(join(process.cwd(), "public", ref.replace(/^\//, ""))));
    expect(missing).toEqual([]);
  });

  it("has no old-site Knit It Now absolute asset URLs", () => {
    const leftover = storedAssetRefs().filter((ref) => OLD_SITE_ASSET_RE.test(ref));
    expect(leftover).toEqual([]);
  });
});
