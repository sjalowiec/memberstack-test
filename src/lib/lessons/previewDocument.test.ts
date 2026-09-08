import { describe, expect, it, vi } from "vitest";

import {
  parseLessonPreviewBody,
  resolveLessonPreviewRecord,
  lessonPreviewUrlExposesDocument,
  lessonPreviewBaseHref,
  htmlWithLessonPreviewBase,
  collectPreviewStylesheetHrefs,
  previewAssetAbsoluteUrl,
  previewAssetResolvesToSiteOrigin,
  LESSON_PREVIEW_PATH,
} from "./previewDocument";

const KIN_DEV_ORIGIN = "https://kin-dev.netlify.app";

const ASTRO_LESSON_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Lesson preview</title>
    <link rel="stylesheet" href="/_astro/Layout.Dxyz.css">
    <link rel="stylesheet" href="/_astro/LessonPage.Ab12.css">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet" />
  </head>
  <body>
    <p class="lesson-preview-banner">Preview — saved draft (not public)</p>
    <h1 class="lesson-header__title">Unsaved title</h1>
  </body>
</html>`;

describe("parseLessonPreviewBody", () => {
  it("renders unsaved editor fields from the posted document", () => {
    const parsed = parseLessonPreviewBody({
      document: {
        slug: "new-member-lesson",
        title: "Unsaved title",
        status: "draft",
        intro: "Unsaved intro",
      },
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok && parsed.mode === "document") {
      expect(parsed.lesson.title).toBe("Unsaved title");
      expect(parsed.lesson.intro).toBe("Unsaved intro");
    }
  });

  it("accepts a saved slug without putting the document in a URL", () => {
    const parsed = parseLessonPreviewBody({ slug: "tuck-on-the-lk150" });
    expect(parsed).toEqual({ ok: true, mode: "slug", slug: "tuck-on-the-lk150" });
    expect(lessonPreviewUrlExposesDocument(LESSON_PREVIEW_PATH)).toBe(false);
    expect(lessonPreviewUrlExposesDocument("/lessons/preview?data=%7B%22title%22%3A%22x%22%7D")).toBe(
      true,
    );
  });
});

describe("resolveLessonPreviewRecord", () => {
  it("does not load or persist when a document is posted", async () => {
    const loadBySlug = vi.fn();
    const result = await resolveLessonPreviewRecord(
      {
        document: {
          slug: "new-member-lesson",
          title: "Edited in the form",
          status: "draft",
        },
      },
      loadBySlug,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.lesson.title).toBe("Edited in the form");
    expect(loadBySlug).not.toHaveBeenCalled();
  });
});

describe("preview HTML asset origin", () => {
  it("injects an explicit site base so stylesheets resolve on kin-dev, not blob:", () => {
    const html = htmlWithLessonPreviewBase(ASTRO_LESSON_HTML, KIN_DEV_ORIGIN);
    expect(html).toContain(`<base href="${KIN_DEV_ORIGIN}/">`);
    expect(html.indexOf("<base href=")).toBeLessThan(html.indexOf('href="/_astro/Layout'));
    expect(html).not.toContain("blob:");
    const hrefs = collectPreviewStylesheetHrefs(html);
    for (const href of hrefs) {
      expect(previewAssetResolvesToSiteOrigin(href, KIN_DEV_ORIGIN)).toBe(true);
    }
    expect(previewAssetAbsoluteUrl("/_astro/LessonPage.Ab12.css", KIN_DEV_ORIGIN)).toBe(
      `${KIN_DEV_ORIGIN}/_astro/LessonPage.Ab12.css`,
    );
    expect(lessonPreviewBaseHref(KIN_DEV_ORIGIN)).toBe(`${KIN_DEV_ORIGIN}/`);
  });
});
