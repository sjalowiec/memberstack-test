import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readCourseContentFile } from "../legacy_kin/courseContentAdmin";
import { COURSE_111_ID } from "../legacy_kin/course111AdminModel";
import { isAccordionLayoutBlock } from "../legacy_kin/courseAccordionLayout";
import {
  bindLegacyCollapse,
  collapsePanelId,
  hasEmbeddedCollapseTrigger,
  presentExerciseAccordionItem,
  rewriteLegacyBootstrapCollapse,
  toggleLegacyCollapse,
} from "./legacyCollapse";
import {
  presentKinCourseHtml,
  readKinCourseGlossary,
} from "./htmlPresent";
import { findLesson, flattenLessons } from "./player";
import { pocToKinCourse } from "./pocToKinCourse";
import { readKinCoursePresentation } from "./presentation";

const COURSE_86_ID = 86;
const LESSON_4233_ANSWERS = [
  {
    prompt: "Set both cam levers to \"H\"",
    needles: "Needles in A-B-D-E",
    answer: "E - Needles do not knit",
    not: "INTARSIA KNITTING",
  },
  {
    prompt: "place 10 needles in E",
    needles: "Opposite the carriage",
    answer: "short row shaping/partial knitting",
    not: "INTARSIA KNITTING",
  },
  {
    prompt: "Change Lever to \"PLAIN\"",
    needles: "Cam Levers to \"N\"",
    answer: "plain knitting (stockinette)",
    not: "INTARSIA KNITTING",
  },
  {
    prompt: "Change Lever to \"PART\"",
    needles: "Needles in B",
    answer: "slip/skip",
    not: "latches open",
  },
  {
    prompt: "Change Lever to \"INTAR\"",
    needles: "NO YARN in the feeder",
    answer: "INTARSIA KNITTING",
    not: "short row shaping/partial knitting",
  },
];

const CIRCULAR_STEPS = [
  "Cast on as for full needle rib",
  "Row 1 (carriage on the left)",
  "Row 2 (carriage on the right)",
];

function panelInner(html: string, panelId: string): string {
  const match = html.match(
    new RegExp(
      `<details\\b[^>]*\\bid="${panelId}"[^>]*>[\\s\\S]*?<div class="kin-legacy-collapse-panel[^"]*">([\\s\\S]*?)</div>\\s*</details>`,
    ),
  );
  return match?.[1] ?? "";
}

function summaryHtml(html: string): string {
  return html.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ?? "";
}

describe("rewriteLegacyBootstrapCollapse", () => {
  it("converts recovered Bootstrap collapse into native details without leaving raw markup", () => {
    const html = rewriteLegacyBootstrapCollapse(
      `<p>Intro</p><a href="#steps" data-toggle="collapse"><b>Steps for Circular Knitting on the TH160</b></a>
<div id="steps" class="collapse hidden-print"><ol><li>Cast on</li></ol></div>`,
    );
    expect(html).toContain('<details class="kin-legacy-collapse" id="steps">');
    expect(html).toContain("<summary");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Steps for Circular Knitting on the TH160");
    expect(html).toContain("<ol><li>Cast on</li></ol>");
    expect(html).not.toContain("&lt;ol");
    expect(html).not.toContain('data-toggle="collapse"');
    expect(html).not.toMatch(/(?:^|[\s"'])collapse(?:[\s"']|$)/);
  });

  it("matches nested anchors in a collapse trigger without truncating the label", () => {
    const html = rewriteLegacyBootstrapCollapse(
      `<a href="#demo" data-toggle="collapse"><div class="circle"><a href="#">1</a></div> Label</a>
<div id="demo" class="collapse">Hidden copy</div>`,
    );
    expect(html).toContain('<div class="circle"><a href="#">1</a></div> Label');
    expect(html).toContain("Hidden copy");
    expect(html).toContain('id="demo"');
  });
});

describe("Course 86 lesson 4233 exercise accordion answers", () => {
  const poc = readCourseContentFile(COURSE_86_ID);
  const presentation = readKinCoursePresentation(COURSE_86_ID);
  const glossary = readKinCourseGlossary(COURSE_86_ID);
  const course = pocToKinCourse(poc, { includeDrafts: true });
  const lesson = findLesson(course, 4233);
  const exercise = lesson?.components.find((component) => component.type === "exercise");

  it("keeps all five admin accordion sections paired with their matching answers", () => {
    const block = poc.lessons
      .flatMap((section) => section.blocks)
      .find((entry) => Number(entry.legacy?.assignId) === 4233);
    expect(block).toBeDefined();
    expect(isAccordionLayoutBlock(block!)).toBe(true);
    const accordion = block!.components.find((component) => component.type === "exerciseAccordion");
    expect(accordion && "sections" in accordion ? accordion.sections : []).toHaveLength(5);

    expect(lesson?.title).toMatch(/check your understanding/i);
    expect(exercise?.items).toHaveLength(5);
    expect(exercise?.items?.map((item) => item.detailsHtml)).toEqual(
      accordion && "sections" in accordion
        ? accordion.sections.map((section: { bodyHtml?: string }) => section.bodyHtml)
        : [],
    );
  });

  it("makes each What happens? control open only its own recovered answer", () => {
    const presented = (exercise?.items ?? []).map((item) =>
      presentExerciseAccordionItem(item, (html) => presentKinCourseHtml(html, 4233, presentation, glossary), (src) => src, {
        lessonId: 4233,
        componentId: exercise?.componentId,
      }),
    );

    expect(presented).toHaveLength(5);
    expect(presented.every((item) => item.mode === "embedded-trigger")).toBe(true);

    presented.forEach((item, index) => {
      const expected = LESSON_4233_ANSWERS[index]!;
      const panelId = collapsePanelId(4233, exercise?.componentId ?? 0, item.order);
      expect(item.html).toContain(`id="${panelId}"`);
      expect(item.html).toContain("What happens?");
      expect(item.html).toContain(expected.prompt);
      expect(item.html).toContain(expected.needles);
      const panel = panelInner(item.html, panelId);
      expect(panel).toContain(expected.answer);
      expect(panel).not.toContain(expected.not);
      expect(item.html).not.toMatch(/<summary\b[^>]*>[\s\S]*<button/i);
      expect(item.html).not.toMatch(/<summary class="[^"]*\bbtn\b/);
      expect(summaryHtml(item.html)).toMatch(/What happens\?/);
      expect(item.html).toContain('aria-expanded="false"');
    });

    expect(presented[1]!.html).toContain("data-GlossaryId='250'");
    expect(presented[1]!.html).toContain("glossaryhelp");
    expect(presented[1]!.html).toContain("/images/course-content/111/arrow2.png");
    expect(presented[1]!.html).not.toContain("/challenge/images/arrow2.png");
  });
});

describe("Course 86 lesson 4245 circular knitting steps", () => {
  const poc = readCourseContentFile(COURSE_86_ID);
  const presentation = readKinCoursePresentation(COURSE_86_ID);
  const glossary = readKinCourseGlossary(COURSE_86_ID);
  const course = pocToKinCourse(poc, { includeDrafts: true });
  const lesson = findLesson(course, 4245);
  const html = presentKinCourseHtml(lesson?.components[0]?.html || "", 4245, presentation, glossary);

  it("renders all recovered circular-knitting steps as HTML inside a native collapse", () => {
    expect(lesson?.title).toMatch(/circular|tubular/i);
    expect(html).toContain("Steps for Circular Knitting on the TH160");
    expect(html).toContain('<details class="kin-legacy-collapse" id="steps">');
    expect(html).toContain("<ol>");
    expect(html).not.toContain("&lt;ol");
    expect(html).not.toContain('data-toggle="collapse"');
    expect(html).not.toMatch(/(?:^|[\s"'])collapse(?:[\s"']|$)/);
    for (const step of CIRCULAR_STEPS) {
      expect(html).toContain(step);
    }
    expect(html).toContain("Repeat these 2 rows");
    expect(html).toContain("open cast on");
    expect(html).toContain("/images/course-content/86/carriage_circular1.jpg");
    expect(html).not.toContain("/challenge/images/v2/86/carriage_circular1.jpg");
    expect(html).toContain('class="imagepopup"');
    expect(html).toContain("/images/glossary/tubular_knitting.jpg");
  });

  it("expands and collapses from the steps trigger with keyboard-accessible expanded state", () => {
    expect(html).toMatch(/<summary\b[^>]*aria-expanded="false"/);
    expect(summaryHtml(html)).toContain("Steps for Circular Knitting on the TH160");

    const attrs = new Map<string, string>([["aria-expanded", "false"]]);
    const details = {
      open: false,
      id: "steps",
      querySelector(selector: string) {
        return selector.includes("summary") || selector.includes("trigger")
          ? {
              setAttribute(name: string, value: string) {
                attrs.set(name, value);
              },
            }
          : null;
      },
    };
    expect(toggleLegacyCollapse(details)).toBe(true);
    expect(details.open).toBe(true);
    expect(attrs.get("aria-expanded")).toBe("true");
    expect(toggleLegacyCollapse(details)).toBe(false);
    expect(details.open).toBe(false);
    expect(attrs.get("aria-expanded")).toBe("false");
  });
});

describe("legacy collapse binding", () => {
  it("syncs aria-expanded and opens a hashed panel", () => {
    const attrs = new Map<string, string>([["aria-expanded", "false"]]);
    const listeners: Array<() => void> = [];
    const details = {
      open: false,
      id: "steps",
      dataset: {} as { kinCollapseBound?: string },
      querySelector(selector: string) {
        return selector.includes("summary")
          ? {
              setAttribute(name: string, value: string) {
                attrs.set(name, value);
              },
            }
          : null;
      },
      addEventListener(_type: string, handler: () => void) {
        listeners.push(handler);
      },
    };
    const root = {
      querySelectorAll(selector: string) {
        return selector.includes("kin-legacy-collapse") ? [details] : [];
      },
    };
    bindLegacyCollapse(root as unknown as ParentNode, "#steps");
    expect(details.open).toBe(true);
    expect(attrs.get("aria-expanded")).toBe("true");
    expect(details.dataset.kinCollapseBound).toBe("true");
    expect(listeners).toHaveLength(1);
  });
});

describe("Course 111 accordion and collapse do not regress", () => {
  const poc = readCourseContentFile(COURSE_111_ID);
  const presentation = readKinCoursePresentation(COURSE_111_ID);
  const glossary = readKinCourseGlossary(COURSE_111_ID);
  const course = pocToKinCourse(poc, { includeDrafts: true });

  it("keeps End Needle Selection as heading-summary accordion sections", () => {
    const lesson = findLesson(course, 6113);
    const exercise = lesson?.components.find((component) => component.type === "exercise");
    expect(exercise?.items).toHaveLength(2);
    const presented = (exercise?.items ?? []).map((item) =>
      presentExerciseAccordionItem(
        item,
        (html) => presentKinCourseHtml(html, 6113, presentation, glossary),
        (src) => src,
        { lessonId: 6113, componentId: exercise?.componentId },
      ),
    );
    expect(presented.every((item) => item.mode === "heading-summary")).toBe(true);
    expect(presented[0]!.headingHtml).toContain("End needle Selection");
    expect(presented[0]!.detailsHtml).toContain("end needles from patterning");
    expect(hasEmbeddedCollapseTrigger(exercise?.items?.[0]?.heading || "")).toBe(false);
  });

  it("preserves Course 111 automatic-patterning copy, glossary links, and nested trigger HTML", () => {
    const lesson = findLesson(course, 6104);
    const html = presentKinCourseHtml(lesson?.components[0]?.html || "", 6104, presentation, glossary);
    expect(html).toContain("DesignaKnit");
    expect(html).toContain("data-GlossaryId=\"730\"");
    expect(html).toContain("glossaryhelp");
    expect(html).toContain("EC1 / PE1 Pattern Controller");
    expect(html).toContain("Lorem ipsum dolor text");
    expect(html).not.toContain("&lt;div");
  });

  it("wires the player through the shared collapse presenter instead of lesson-specific scripts", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/kinCourse/KinCourseComponents.astro"),
      "utf8",
    );
    expect(source).toContain("presentExerciseAccordionItem");
    expect(source).toContain("bindLegacyCollapse");
    expect(source).not.toContain("4233");
    expect(source).not.toContain("4245");
  });
});
