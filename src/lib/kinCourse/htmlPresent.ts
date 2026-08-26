import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { KinCoursePresentation } from "./types";

export type KinCourseGlossaryEntry = {
  glossaryId: number;
  slug: string;
  term: string;
  example: string;
  helpinfo: string;
};

export function readKinCourseGlossary(courseId: number): KinCourseGlossaryEntry[] {
  const path = join(process.cwd(), "src", "data", "kin_courses", String(courseId), "glossary.json");
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as KinCourseGlossaryEntry[];
  } catch {
    return [];
  }
}

export function glossaryModalHref(id: number): string {
  return `#glossary-${id}`;
}

function withNewWindowAttrs(attrs: string): string {
  let next = attrs;
  if (/target=/i.test(next)) {
    next = next.replace(/target=["'][^"']*["']/i, 'target="_blank"');
  } else {
    next += ' target="_blank"';
  }
  if (/rel=/i.test(next)) {
    if (!/noopener/i.test(next)) {
      next = next.replace(/rel=["']([^"']*)["']/i, 'rel="$1 noopener"');
    }
  } else {
    next += ' rel="noopener"';
  }
  return next;
}

export function applyKinCourseSrcRewrites(
  value: string,
  presentation: KinCoursePresentation = {},
): string {
  let out = value;
  for (const rule of presentation.rewriteSrc ?? []) {
    out = out.split(rule.from).join(rule.to);
  }
  return out;
}

export function ensurePdfOpensInNewWindow(html: string): string {
  return html.replace(/<a\b([^>]*)>/gi, (full, attrs: string) => {
    const href = /href=["']([^"']+)["']/i.exec(attrs)?.[1] || "";
    const pathOnly = href.split(/[?#]/)[0];
    if (!/\.pdf$/i.test(pathOnly)) return full;
    return `<a${withNewWindowAttrs(attrs)}>`;
  });
}

export function presentKinCourseHtml(
  html: string,
  lessonId: number,
  presentation: KinCoursePresentation = {},
  glossary: KinCourseGlossaryEntry[] = [],
): string {
  let out = html;
  if (presentation.removeClassroomCtas) {
    out = out.replace(/<a\b[^>]*href="\/classrooms\/[^"]+"[^>]*>[\s\S]*?<\/a>/gi, "");
  }
  if (presentation.removePurchaseCtas?.some((rule) => rule.lessonId === lessonId)) {
    out = out.replace(
      /<a\b[^>]*href="\/store\/product\/\d+\/[^"]+"[^>]*>[\s\S]*?<\/a>(?:\s*<br\s*\/?>)*/gi,
      "",
    );
  }
  out = applyKinCourseSrcRewrites(out, presentation);
  const hrefRules = presentation.rewriteHref ?? [];
  if (hrefRules.length) {
    out = out.replace(/<a\b([^>]*)>/gi, (full, attrs: string) => {
      const href = /href=["']([^"']+)["']/i.exec(attrs)?.[1] || "";
      const pathOnly = href.split(/[?#]/)[0];
      const rule = hrefRules.find((item) => item.from === pathOnly || item.from === href);
      if (!rule) return full;
      let next = attrs.replace(/href=["'][^"']*["']/i, `href="${rule.to}"`);
      next = withNewWindowAttrs(next);
      return `<a${next}>`;
    });
  }
  const allowed = new Set(
    (presentation.glossaryLinks ?? [])
      .filter((rule) => rule.confidence === "HIGH")
      .map((rule) => Number(rule.legacyId))
      .filter((id) => Number.isFinite(id)),
  );
  if (allowed.size && glossary.length) {
    const byId = new Map(glossary.map((entry) => [entry.glossaryId, entry]));
    out = out.replace(/<a\b([^>]*)>/gi, (full, attrs: string) => {
      const glossaryId = Number(/data-GlossaryId=["'](\d+)["']/i.exec(attrs)?.[1] || "");
      const id = Number.isFinite(glossaryId) && allowed.has(glossaryId) ? glossaryId : 0;
      const entry = id ? byId.get(id) : undefined;
      if (!entry) return full;
      let next = attrs;
      const dest = glossaryModalHref(entry.glossaryId);
      if (/href=/i.test(next)) next = next.replace(/href=["'][^"']*["']/i, `href="${dest}"`);
      else next += ` href="${dest}"`;
      if (!/glossaryhelp/i.test(next)) {
        if (/class=/i.test(next)) next = next.replace(/class=["']([^"']*)["']/i, 'class="$1 glossaryhelp"');
        else next += ' class="glossaryhelp"';
      }
      return `<a${next}>`;
    });
  }
  return ensurePdfOpensInNewWindow(out);
}
