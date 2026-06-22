import { describe, expect, it } from "vitest";
import {
  LEGACY_ASSET_ORIGIN,
  legacyAssetUrl,
  LOCAL_PUBLIC_PATH_PREFIXES,
  rewriteLegacyHtml,
} from "./legacyCourseAssetUrls";

describe("legacyAssetUrl", () => {
  it.each(LOCAL_PUBLIC_PATH_PREFIXES.map((prefix) => [prefix, `${prefix}example`] as const))(
    "keeps local public assets under %s root-relative",
    (prefix, path) => {
      expect(legacyAssetUrl(path)).toBe(path);
    },
  );

  it("keeps migrated challenge image paths local", () => {
    expect(legacyAssetUrl("/challenge/images/v2/50/release_lever.png")).toBe(
      "/challenge/images/v2/50/release_lever.png",
    );
  });

  it("keeps download paths local", () => {
    expect(legacyAssetUrl("/downloads/quickstart_checklist.pdf")).toBe(
      "/downloads/quickstart_checklist.pdf",
    );
  });

  it("rewrites other root-relative paths to the legacy origin", () => {
    expect(legacyAssetUrl("/KIN_Images/Challenges/example.jpg")).toBe(
      `${LEGACY_ASSET_ORIGIN}/KIN_Images/Challenges/example.jpg`,
    );
  });

  it("rewrites bare relative paths to the legacy origin", () => {
    expect(legacyAssetUrl("KIN_Images/Challenges/example.jpg")).toBe(
      `${LEGACY_ASSET_ORIGIN}/KIN_Images/Challenges/example.jpg`,
    );
  });

  it("preserves absolute and protocol-relative URLs", () => {
    expect(legacyAssetUrl("https://cdn.example.com/a.png")).toBe(
      "https://cdn.example.com/a.png",
    );
    expect(legacyAssetUrl("//www.knititnow.com/challenge/images/swatch_measure.jpg")).toBe(
      "https://www.knititnow.com/challenge/images/swatch_measure.jpg",
    );
  });
});

describe("rewriteLegacyHtml", () => {
  it("does not rewrite local challenge image src attributes", () => {
    const input = '<img src="/challenge/images/v2/50/release_lever.png">';
    expect(rewriteLegacyHtml(input)).toBe(input);
  });

  it("does not rewrite local images src attributes", () => {
    const input = '<img src="/images/patterns/example.webp">';
    expect(rewriteLegacyHtml(input)).toBe(input);
  });

  it("does not rewrite local download href attributes", () => {
    const input = '<a href="/downloads/quickstart_checklist.pdf">Checklist</a>';
    expect(rewriteLegacyHtml(input)).toBe(input);
  });

  it("does not rewrite local docs href attributes", () => {
    const input = '<a href="/docs/guide.pdf">Guide</a>';
    expect(rewriteLegacyHtml(input)).toBe(input);
  });

  it("rewrites legacy root-relative image src attributes to the legacy origin", () => {
    expect(
      rewriteLegacyHtml('<img class="img-responsive" src="/KIN_Images/Challenges/example.jpg">'),
    ).toBe(
      `<img class="img-responsive" src="${LEGACY_ASSET_ORIGIN}/KIN_Images/Challenges/example.jpg">`,
    );
  });

  it("rewrites bare relative image src attributes to the legacy origin", () => {
    expect(rewriteLegacyHtml('<img src="KIN_Images/Challenges/example.jpg">')).toBe(
      `<img src="${LEGACY_ASSET_ORIGIN}/KIN_Images/Challenges/example.jpg">`,
    );
  });

  it("preserves absolute image src attributes", () => {
    const input = '<img src="https://cdn.example.com/a.png">';
    expect(rewriteLegacyHtml(input)).toBe(input);
  });

  it("keeps migrated challenge PDF hrefs local", () => {
    const input = '<a href="/challenge/images/v2/50/lk-150KIN.pdf">Manual</a>';
    expect(rewriteLegacyHtml(input)).toBe(input);
  });

  it("rewrites legacy PDF hrefs to the legacy origin", () => {
    expect(rewriteLegacyHtml('<a href="/KIN_Images/Challenges/guide.pdf">Guide</a>')).toBe(
      `<a href="${LEGACY_ASSET_ORIGIN}/KIN_Images/Challenges/guide.pdf">Guide</a>`,
    );
  });
});
