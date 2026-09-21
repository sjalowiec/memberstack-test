/**
 * Narrow Sleeveless/Drop display-row HTML: piece banners, collapsible sections,
 * and instruction blocks. Sideways Cardigan BODY uses this instead of the full
 * Sleeveless page initializer.
 */

import { parseInlineMarkedLine } from "./inlineRcHeading";
import { rowCounterResetBlockHtml } from "./rowCounterReset";
import { renderDropShoulderSleeveShapingChartHtml } from "./dropShoulderSleeveShapingChart";
import { renderSleevelessBodyShapingChartHtml } from "./sleevelessBodyShapingChartHtml";
import { patternTipWrapperHtml, type SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";

export function escapePatternDisplayHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function wrapPatternSectionHtml(
  sectionId: string,
  titleHtml: string,
  innerHtml: string,
  opts?: { defaultCollapsed?: boolean; sectionClassName?: string },
): string {
  const sid = String(sectionId).replace(/[^a-zA-Z0-9_-]/g, "");
  const defaultCollapsed = opts?.defaultCollapsed === true;
  const sectionClassName =
    typeof opts?.sectionClassName === "string" && opts.sectionClassName.trim()
      ? ` ${opts.sectionClassName.trim()}`
      : "";
  const collapsedClass = defaultCollapsed ? " is-collapsed" : "";
  const checkedAttr = defaultCollapsed ? " checked" : "";
  return `<section id="${sid}" class="pattern-section${sectionClassName}${collapsedClass}" data-section-id="${sid}">
  <div class="pattern-section__header">
    <label class="pattern-section__collapse-label">
      <input type="checkbox" class="pattern-section__collapse" data-section-id="${sid}" aria-label="Collapse this section"${checkedAttr} />
    </label>
    <div class="pattern-section__heading"><h2>${titleHtml}</h2></div>
  </div>
  <div class="pattern-section__content">${innerHtml}</div>
</section>`;
}

export type PatternDisplayBlockRenderOptions = {
  pieceSectionId?: string;
};

/** One instruction block: RC, prose, optional shaping chart, stitch count. */
export function renderPatternDisplayBlockHtml(
  row: Extract<SleevelessPatternDisplayRow, { kind: "block" }>,
  opts?: PatternDisplayBlockRenderOptions,
): string {
  const pieceSectionId = opts?.pieceSectionId || "back";
  const showStitch = row.stitchCount !== undefined;
  const leftBits: string[] = [];
  if (row.rowCounterReset) {
    leftBits.push(rowCounterResetBlockHtml(row.rowCounterResetGarmentRc ?? 0));
  }
  if (row.rc) {
    leftBits.push(`<p class="sleeveless-pattern-rc">${escapePatternDisplayHtml(row.rc)}</p>`);
  }
  const trusted = row.trustedParagraphs;
  if (trusted && trusted.length > 0) {
    for (const p of trusted) {
      const t = String(p).trim();
      if (!t) continue;
      const marked = parseInlineMarkedLine(t);
      if (marked) {
        const cls =
          marked.kind === "rc-heading" ? "sleeveless-pattern-rc" : "sleeveless-pattern-subhead";
        leftBits.push(`<p class="${cls}">${escapePatternDisplayHtml(marked.text)}</p>`);
        continue;
      }
      leftBits.push(`<p class="sleeveless-pattern-line">${p}</p>`);
    }
  } else {
    for (const p of row.paragraphs) {
      const t = String(p).trim();
      if (t) leftBits.push(`<p class="sleeveless-pattern-line">${escapePatternDisplayHtml(t)}</p>`);
    }
  }
  if (row.bodyShapingChartRows && row.bodyShapingChartRows.length > 0) {
    leftBits.push(
      renderSleevelessBodyShapingChartHtml(row.bodyShapingChartRows, {
        chartId:
          row.bodyShapingChartId ||
          `sleeveless-body-shaping-chart-${pieceSectionId}`,
      }),
    );
  }
  if (row.sleeveShapingChartRows && row.sleeveShapingChartRows.length > 0) {
    leftBits.push(
      renderDropShoulderSleeveShapingChartHtml(row.sleeveShapingChartRows, {
        chartId: `drop-shoulder-sleeve-shaping-chart-${pieceSectionId}`,
        showTitle: false,
      }),
    );
  }
  if (row.tipHtml) {
    leftBits.push(patternTipWrapperHtml(row));
  }
  const leftHtml = `<div class="sleeveless-pattern-left">${leftBits.join("")}</div>`;
  const census = row.stitchCensus;
  const showCensus = census !== undefined && census.held > 0;
  const censusLabel = showCensus
    ? `${census.working} working · ${census.held} held · ${census.total} total`
    : "";
  const rightHtml = showCensus
    ? `<div class="sleeveless-pattern-sts sleeveless-pattern-sts--census">${escapePatternDisplayHtml(
        censusLabel,
      )}${
        row.stitchCensusFinalWorking !== undefined
          ? `<span class="sleeveless-pattern-sts__final">then ${escapePatternDisplayHtml(
              String(row.stitchCensusFinalWorking),
            )} working</span>`
          : ""
      }</div>`
    : showStitch
      ? `<div class="sleeveless-pattern-sts">${row.stitchCount} sts</div>`
      : "";
  const rowClass = rightHtml
    ? "sleeveless-pattern-row"
    : "sleeveless-pattern-row sleeveless-pattern-row--full";
  return `<div class="${rowClass}">${leftHtml}${rightHtml}</div>`;
}

export type PatternDisplayRowsRenderOptions = {
  pieceSectionId?: string;
  omitPieceBanner?: boolean;
};

/**
 * Piece / section / block HTML only. Chart mounts, bust darts, and Visual Guides
 * stay in the Sleeveless page initializer.
 */
export function renderPatternDisplayRowsHtml(
  rows: readonly SleevelessPatternDisplayRow[],
  opts?: PatternDisplayRowsRenderOptions,
): string {
  const pieceSectionId = opts?.pieceSectionId || "back";
  const omitPieceBanner = opts?.omitPieceBanner === true;
  const list = Array.isArray(rows) ? rows : [];
  const parts: string[] = [];
  let openSectionSlugSource: string | null = null;
  let openSectionDisplayHeading: string | null = null;
  let openSectionParts: string[] = [];

  function flushOpenSection() {
    if (!openSectionSlugSource) return;
    const sectionSlug = openSectionSlugSource
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const headingHtml = openSectionDisplayHeading ?? openSectionSlugSource;
    parts.push(
      wrapPatternSectionHtml(
        `sg-${pieceSectionId}-${sectionSlug || "section"}`,
        headingHtml,
        openSectionParts.join(""),
        { defaultCollapsed: false, sectionClassName: "pattern-subsection" },
      ),
    );
    openSectionSlugSource = null;
    openSectionDisplayHeading = null;
    openSectionParts = [];
  }

  for (const row of list) {
    if (row.kind === "piece") {
      flushOpenSection();
      if (!omitPieceBanner) {
        parts.push(`<h2 class="sleeveless-pattern-piece">${escapePatternDisplayHtml(row.title)}</h2>`);
      }
      continue;
    }
    if (row.kind === "section") {
      flushOpenSection();
      const rawTitle = String(row.title || "");
      openSectionSlugSource = escapePatternDisplayHtml(rawTitle);
      const trustedTitleHtml =
        typeof row.titleHtml === "string" && row.titleHtml.trim() ? row.titleHtml : null;
      openSectionDisplayHeading = trustedTitleHtml ?? openSectionSlugSource;
      continue;
    }
    if (row.kind !== "block") continue;
    const chunk = renderPatternDisplayBlockHtml(row, { pieceSectionId });
    if (openSectionSlugSource) openSectionParts.push(chunk);
    else parts.push(chunk);
  }
  flushOpenSection();
  return `<div class="sleeveless-pattern-instructions">${parts.join("")}</div>`;
}

export function setPatternSectionCollapsed(section: HTMLElement, collapsed: boolean): void {
  const id = section.dataset.sectionId;
  if (!id) return;
  const header = section.querySelector(":scope > .pattern-section__header");
  const checkbox = header?.querySelector("input.pattern-section__collapse");
  if (!(checkbox instanceof HTMLInputElement)) return;
  checkbox.checked = collapsed;
  section.classList.toggle("is-collapsed", collapsed);
  try {
    localStorage.setItem(`sleevelessPattern_section_${id}`, collapsed ? "true" : "false");
  } catch {
    /* quota */
  }
}

/** Collapse persistence for extracted section markup (no Sleeveless page boot). */
export function bindPatternSectionCollapse(root: ParentNode | null | undefined): void {
  if (!root || !("querySelectorAll" in root)) return;
  const el = root as ParentNode & { dataset?: DOMStringMap };
  if (el instanceof HTMLElement && el.dataset.patternSectionCollapseBound === "true") return;
  if (el instanceof HTMLElement) el.dataset.patternSectionCollapseBound = "true";

  root.querySelectorAll(".pattern-section, .pattern-subsection").forEach((section) => {
    if (!(section instanceof HTMLElement)) return;
    const id = section.dataset.sectionId;
    if (!id) return;
    const collapsed = localStorage.getItem(`sleevelessPattern_section_${id}`) === "true";
    setPatternSectionCollapsed(section, collapsed);
  });

  const host = root instanceof HTMLElement ? root : document;
  host.addEventListener("change", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || !t.classList.contains("pattern-section__collapse")) {
      return;
    }
    const section = t.closest(".pattern-section, .pattern-subsection");
    const id = t.dataset.sectionId || (section instanceof HTMLElement ? section.dataset.sectionId : "");
    if (!(section instanceof HTMLElement) || !id) return;
    setPatternSectionCollapsed(section, t.checked);
  });
}
