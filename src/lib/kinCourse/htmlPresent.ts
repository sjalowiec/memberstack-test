import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveLegacyGlossaryHref } from "./legacyGlossaryHrefs";
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

function setAnchorHref(attrs: string, href: string): string {
  if (/href=/i.test(attrs)) return attrs.replace(/href=["'][^"']*["']/i, `href="${href}"`);
  return `${attrs} href="${href}"`;
}

function withGlossaryHelpAttrs(attrs: string, glossaryId: number): string {
  let next = attrs;
  if (!/data-GlossaryId=/i.test(next)) next += ` data-GlossaryId="${glossaryId}"`;
  if (!/glossaryhelp/i.test(next)) {
    if (/class=/i.test(next)) next = next.replace(/class=["']([^"']*)["']/i, 'class="$1 glossaryhelp"');
    else next += ' class="glossaryhelp"';
  }
  next = next.replace(/\s*target=["'][^"']*["']/gi, "");
  return next;
}

/**
 * Rewrite production `/glossary/{id}/{slug}/term` hrefs onto DEV targets.
 * Catalog matches open the in-player modal; unknown ids fall back to `/glossary/{slug}/`.
 */
export function applyLegacyGlossaryHrefRewrites(
  html: string,
  glossary: KinCourseGlossaryEntry[] = [],
): string {
  return html.replace(/<a\b([^>]*)>/gi, (full, attrs: string) => {
    const href = /href=["']([^"']+)["']/i.exec(attrs)?.[1] || "";
    const resolved = resolveLegacyGlossaryHref(href, glossary);
    if (!resolved) return full;
    let next = setAnchorHref(attrs, resolved.href);
    if (resolved.modal) next = withGlossaryHelpAttrs(next, resolved.glossaryId);
    return `<a${next}>`;
  });
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

const BOOTSTRAP_COL_CLASS_RE = /\bcol-(?:xs|sm|md|lg)-\d+\b/;
const THUMBNAIL_CARD_RE =
  /<div\s+class="([^"]*)"\s*>((?:\s|<a\b)(?:(?!<\/div>)[\s\S])*?<img\b[^>]*\bimg-thumbnail\b[\s\S]*?<\/a>\s*)<\/div>/gi;

function isRestorableThumbnailCardClass(className: string): boolean {
  return /\btext-center\b/.test(className) && !BOOTSTRAP_COL_CLASS_RE.test(className);
}

/**
 * Production KIN HTML used Bootstrap 3 `.row > .col-sm-2.col-xs-12.text-center`
 * around `img.img-thumbnail` download cards. Cleaned POC HTML unwraps those
 * layout divs, which leaves full-width stacked images. Restore the grid at
 * present time so stored course data is unchanged.
 */
export function restoreLegacyBootstrapThumbnailGrid(html: string): string {
  type Hit = { start: number; end: number; className: string; inner: string };
  const hits: Hit[] = [];
  const re = new RegExp(THUMBNAIL_CARD_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const className = match[1] || "";
    if (!isRestorableThumbnailCardClass(className)) continue;
    hits.push({
      start: match.index,
      end: match.index + match[0].length,
      className,
      inner: match[2] || "",
    });
  }
  if (!hits.length) return html;

  const groups: Hit[][] = [];
  let current: Hit[] = [hits[0]!];
  for (let i = 1; i < hits.length; i++) {
    const prev = hits[i - 1]!;
    const next = hits[i]!;
    const between = html.slice(prev.end, next.start);
    if (/^[\s]*$/.test(between)) current.push(next);
    else {
      groups.push(current);
      current = [next];
    }
  }
  groups.push(current);

  let out = html;
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i]!;
    const start = group[0]!.start;
    const end = group[group.length - 1]!.end;
    const cells = group.map((hit) => {
      const className = `${hit.className} col-sm-2 col-xs-12`.replace(/\s+/g, " ").trim();
      return `<div class="${className}">${hit.inner}</div>`;
    });
    out = `${out.slice(0, start)}<div class="row">${cells.join("")}</div>${out.slice(end)}`;
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
  out = applyLegacyGlossaryHrefRewrites(out, glossary);
  out = restoreLegacyBootstrapThumbnailGrid(out);
  return ensurePdfOpensInNewWindow(out);
}
