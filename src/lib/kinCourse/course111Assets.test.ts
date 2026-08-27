import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readCourseContentFile } from "../legacy_kin/courseContentAdmin";
import { COURSE_111_ID } from "../legacy_kin/course111AdminModel";
import {
  applyKinCourseSrcRewrites,
  presentKinCourseHtml,
  readKinCourseGlossary,
} from "./htmlPresent";
import { loadKinCourseBundle } from "./load";
import { flattenLessons } from "./player";
import { pocToKinCourse } from "./pocToKinCourse";
import { readKinCoursePresentation } from "./presentation";

const ATTR_RE = /(?:src|href|data-image)=["']([^"']+)["']/gi;
const CSS_URL_RE = /url\((['"]?)([^'")]+)\1\)/gi;
const LOCAL_ASSET_RE =
  /\.(?:jpg|jpeg|png|gif|webp|pdf|svg|stp|zip)$/i;

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

function isCheckableLocalAsset(ref: string): boolean {
  if (!ref.startsWith("/")) return false;
  if (ref.startsWith("/courses/") || ref.startsWith("/glossary/") || ref.startsWith("/stitch")) {
    return false;
  }
  return (
    LOCAL_ASSET_RE.test(ref) ||
    ref.startsWith("/images/") ||
    ref.startsWith("/contentlibrary/") ||
    ref.startsWith("/path/") ||
    ref.startsWith("/swatches/") ||
    ref.startsWith("/challenge/")
  );
}

describe("Course 111 presented assets", () => {
  const presentation = readKinCoursePresentation(111);
  const glossary = readKinCourseGlossary(111);
  const poc = readCourseContentFile(COURSE_111_ID);
  const course = pocToKinCourse(poc, { includeDrafts: false });

  it("loads the published course without preview/includeDrafts", async () => {
    const bundle = await loadKinCourseBundle(COURSE_111_ID);
    expect(bundle).toBeTruthy();
    expect(bundle?.course.id).toBe(111);
    expect(bundle?.landing.catalogSlug).toBe("mastering-the-silver-reed-sk840");
    expect(flattenLessons(bundle!.course).length).toBeGreaterThan(10);
    expect(flattenLessons(bundle!.course).some((lesson) => lesson.id === 6171)).toBe(false);
  });

  it("rewrites leftover challenge and remote Fairisle paths onto existing local files", () => {
    const html = presentKinCourseHtml(
      [
        '<img src="/challenge/images/v2/111/learn_dak_logos.png">',
        '<span class="imagepopup" data-image="/challenge/images/v2/111/sensor.jpg"></span>',
        '<span class="imagepopup" data-image="/challenge/images/v2/111/notes.jpg"></span>',
        '<span class="imagepopup" data-image="/challenge/images/v2/111/ribber_cover.jpg"></span>',
        '<img src="https://www.knititnow.com/contentlibrary/previewimages/thumb_693.jpg">',
      ].join(""),
      6117,
      presentation,
      glossary,
    );
    expect(html).not.toContain("/challenge/images/v2/111/");
    expect(html).not.toContain("https://www.knititnow.com/contentlibrary/previewimages/thumb_693.jpg");
    expect(html).not.toContain("/contentlibrary/previewimages/thumb_693.jpg");
    expect(html).toContain("/images/course-content/111/learn_dak_logos.png");
    expect(html).toContain('data-image="/images/course-content/111/sensor.jpg"');
    expect(html).toContain('data-image="/images/course-content/111/notes.jpg"');
    expect(html).toContain('data-image="/images/course-content/111/ribber_cover.jpg"');
    expect(html).toContain("/images/course-content/111/thumb_693.jpg");
  });

  it("resolves every published local image, popup, CSS url(), and download after presentation", () => {
    const refs = new Set<string>();
    for (const lesson of flattenLessons(course)) {
      for (const component of lesson.components) {
        if (component.html) {
          collectFromHtml(
            presentKinCourseHtml(component.html, lesson.id, presentation, glossary),
            refs,
          );
        }
        if (component.src) refs.add(applyKinCourseSrcRewrites(component.src, presentation));
        if (component.filename) {
          refs.add(applyKinCourseSrcRewrites(component.filename, presentation));
        }
        if (component.image) refs.add(applyKinCourseSrcRewrites(component.image, presentation));
        for (const slide of component.slides ?? []) {
          if (slide.src) refs.add(applyKinCourseSrcRewrites(slide.src, presentation));
          if (slide.caption) {
            collectFromHtml(
              presentKinCourseHtml(slide.caption, lesson.id, presentation, glossary),
              refs,
            );
          }
        }
        for (const item of component.items ?? []) {
          if (item.image) refs.add(applyKinCourseSrcRewrites(item.image, presentation));
          if (item.detailsHtml) {
            collectFromHtml(
              presentKinCourseHtml(item.detailsHtml, lesson.id, presentation, glossary),
              refs,
            );
          }
        }
      }
    }

    const localAssets = [...refs].filter(isCheckableLocalAsset);
    expect(localAssets.length).toBeGreaterThan(50);
    expect(localAssets.filter((ref) => ref.includes("/challenge/"))).toEqual([]);
    expect(localAssets).toContain("/images/course-content/111/sensor.jpg");
    expect(localAssets).toContain("/images/course-content/111/notes.jpg");
    expect(localAssets).toContain("/images/course-content/111/ribber_cover.jpg");
    expect(localAssets).toContain("/images/course-content/111/thumb_693.jpg");

    const missing = localAssets.filter((ref) => {
      const diskPath = join(process.cwd(), "public", ref.replace(/^\//, ""));
      return !existsSync(diskPath);
    });
    expect(missing).toEqual([]);
  });
});
