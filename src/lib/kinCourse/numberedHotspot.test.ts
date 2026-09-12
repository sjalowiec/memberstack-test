import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readCourseContentFile } from "../legacy_kin/courseContentAdmin";
import { COURSE_111_ID } from "../legacy_kin/course111AdminModel";
import { getCourseCatalogEntries } from "../coursesCatalog";
import { flattenLessons } from "./player";
import { pocToKinCourse } from "./pocToKinCourse";
import { readKinCoursePresentation } from "./presentation";
import {
  buildNumberedHotspotHtml,
  numberedHotspotReady,
  presentHotspotComponent,
  visualHotspotOrder,
} from "./numberedHotspot";

const COURSE_86_WEBP = {
  6444: "/images/course-content/86/terms.webp",
  6410: "/images/course-content/86/tools.webp",
  6459: "/images/course-content/86/tools-ribber.webp",
  6475: "/images/course-content/86/ribber_carriage.webp",
} as const;

function publicFromSrc(src: string): string {
  return join(process.cwd(), "public", ...src.replace(/^\//, "").split("/"));
}

describe("Course 86 numbered hotspot layouts", () => {
  const poc = readCourseContentFile(86);
  const course = pocToKinCourse(poc, { includeDrafts: true });
  const presentation = readKinCoursePresentation(86);
  const hotspots = flattenLessons(course).flatMap((lesson) =>
    lesson.components
      .filter((component) => component.type === "hotspot")
      .map((component) => ({ lesson, component })),
  );

  it("finds four Course 86 hotspot components", () => {
    expect(hotspots.map((entry) => entry.component.componentId)).toEqual([6444, 6410, 6459, 6475]);
  });

  it("enables all four static layouts with the uploaded WebP files", () => {
    const rules = presentation.numberedHotspots ?? [];
    expect(rules).toHaveLength(4);
    expect(rules.every((rule) => rule.enabled === true)).toBe(true);
    expect(rules.map((rule) => [rule.componentId, rule.numberedSrc])).toEqual([
      [6444, COURSE_86_WEBP[6444]],
      [6410, COURSE_86_WEBP[6410]],
      [6459, COURSE_86_WEBP[6459]],
      [6475, COURSE_86_WEBP[6475]],
    ]);
    for (const src of Object.values(COURSE_86_WEBP)) {
      expect(existsSync(publicFromSrc(src))).toBe(true);
    }
    for (const entry of hotspots) {
      expect(numberedHotspotReady(entry.lesson.id, entry.component, presentation)).toBe(true);
    }
  });

  it("renders the Course 111 static layout instead of clickable hotspot buttons", () => {
    for (const entry of hotspots) {
      const presented = presentHotspotComponent(entry.lesson.id, entry.component, presentation);
      expect(presented.mode).toBe("static");
      if (presented.mode !== "static") continue;
      const expectedSrc = COURSE_86_WEBP[entry.component.componentId as keyof typeof COURSE_86_WEBP];
      expect(presented.html).toContain(`src="${expectedSrc}"`);
      expect(presented.html).toContain('class="sk840-parts-id__layout"');
      expect(presented.html).toContain('class="legacy-hotspot-labels sk840-parts-id__ol"');
      expect(presented.html).not.toContain("legacy-hotspot-spot");
      expect(presented.html).not.toContain("<button");
      const rule = presentation.numberedHotspots?.find(
        (item) => item.componentId === entry.component.componentId,
      );
      for (const item of rule?.items ?? []) {
        const encoded = item.label.replace(/&/g, "&amp;");
        expect(presented.html).toContain(`<li>${encoded}</li>`);
      }
    }
  });

  it("keeps the prepared numbered labels", () => {
    const terms = presentation.numberedHotspots?.find((rule) => rule.componentId === 6444);
    expect(buildNumberedHotspotHtml(terms!).match(/<li>/g)?.length).toBe(8);
    expect(terms?.items.map((item) => item.label)).toEqual([
      "Yarn Mast Assembly",
      "Row Counter",
      "Main Knitting Carriage",
      "Main Needlebed",
      "Needle Position Indicator",
      "Sponge Bar (Needle Presser Bar)",
      "Sinker Plate",
      "Number Strip",
    ]);
  });

  it("removes the obsolete flashing-hotspots instruction from Course 86", () => {
    const html = flattenLessons(course)
      .flatMap((lesson) => lesson.components.map((component) => component.html || ""))
      .join("\n");
    expect(html).not.toMatch(/Click the flashing ["“]hotspots["']/i);
    expect(readFileSync(join(process.cwd(), "src/data/legacy_kin/cleaned/course_86_taitexma_th_tr_160_getting_started.poc.json"), "utf8")).not.toMatch(
      /Click the flashing/,
    );
  });

  it("numbers spots top-to-bottom, then left-to-right in the same row", () => {
    const byId = (id: number) => hotspots.find((entry) => entry.component.componentId === id);
    expect(visualHotspotOrder(byId(6444)!.component.spots || []).map((item) => item.label)).toEqual([
      "Yarn Mast Assembly",
      "Row Counter",
      "Main Knitting Carriage",
      "Main Needlebed",
      "Needle Position Indicator",
      "Sponge Bar (Needle Presser Bar)",
      "Sinker Plate",
      "Number Strip",
    ]);
  });

  it("does not add Course 86 to the public catalog", () => {
    const entries = getCourseCatalogEntries();
    expect(entries.some((course) => course.href === "/courses/86")).toBe(false);
  });

  it("wires the player through presentHotspotComponent instead of always rendering LegacyHotspot", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/kinCourse/KinCourseComponents.astro"),
      "utf8",
    );
    expect(source).toContain("presentHotspotComponent");
    expect(source).toContain("presented.mode === 'static'");
    expect(source).toContain("LegacyHotspot");
  });
});

describe("Course 111 numbered-image layouts stay unchanged", () => {
  it("keeps the SK840 numbered PNG HTML and does not use Course 86 WebP files", () => {
    const poc = readCourseContentFile(COURSE_111_ID);
    const course = pocToKinCourse(poc, { includeDrafts: true });
    const presentation = readKinCoursePresentation(111);
    expect(presentation.numberedHotspots).toBeUndefined();

    const html = flattenLessons(course)
      .flatMap((lesson) => lesson.components.map((component) => component.html || ""))
      .join("\n");
    expect(html).toContain("/images/course-content/111/carriage_main1_numbered.png");
    expect(html).toContain("/images/course-content/111/tools_numbered.png");
    expect(html).toContain('class="sk840-parts-id__layout"');
    expect(html).not.toContain("/images/course-content/86/terms.webp");
    expect(html).not.toContain("/images/course-content/86/tools.webp");
    expect(existsSync(join(process.cwd(), "public/images/course-content/111/carriage_main1_numbered.png"))).toBe(
      true,
    );
    expect(existsSync(join(process.cwd(), "public/images/course-content/111/tools_numbered.png"))).toBe(true);
  });
});
