/**
 * Arranges an already-rendered pattern for one print choice.
 * Chart numbers stay in the page; this only shows, hides, and orders them.
 */

import type { PatternPrintChoice } from "./patternPrintChoice";

const CHART_SELECTOR = [
  ".ns-shaping-chart",
  ".ns-visual-guides__card",
  ".shaping-map",
  "[data-heel-toe-shaping-map]",
].join(", ");

function chartRoots(root: ParentNode): HTMLElement[] {
  const all = [...root.querySelectorAll<HTMLElement>(CHART_SELECTOR)];
  return all.filter((element) => !all.some((other) => other !== element && other.contains(element)));
}

function projectTitle(doc: Document): string {
  const slot = doc.querySelector("[data-pattern-print-personalization-title]");
  const fromSlot = slot?.textContent?.trim() ?? "";
  if (fromSlot) return fromSlot;
  const heading = doc.querySelector("[data-sleeveless-pattern-online-heading], [data-pattern-print-title], h1");
  const fromHeading = heading?.textContent?.trim() ?? "";
  if (fromHeading) return fromHeading;
  return doc.title.trim();
}

function pieceHeadingBefore(chart: HTMLElement): HTMLElement | null {
  return textElementBefore(chart, ".sleeveless-pattern-piece, .print-piece-title, h2.pattern-piece");
}

function textElementBefore(chart: HTMLElement, selector: string): HTMLElement | null {
  const matches = [...(chart.ownerDocument?.querySelectorAll<HTMLElement>(selector) ?? [])];
  const earlier = matches.filter(
    (element) => (element.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
  );
  return earlier.at(-1) ?? null;
}

/** The reset that applies to this chart: the latest one in the same garment piece, before the chart. */
function rowCounterResetBefore(chart: HTMLElement): HTMLElement | null {
  const piece = pieceHeadingBefore(chart);
  const resets = [...(chart.ownerDocument?.querySelectorAll<HTMLElement>(".row-counter-reset") ?? [])];
  const earlier = resets.filter((reset) => {
    const beforeChart = (reset.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    const afterPiece =
      !piece || (piece.compareDocumentPosition(reset) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    return beforeChart && afterPiece;
  });
  return earlier.at(-1) ?? null;
}

function chartLabel(chart: HTMLElement, project: string, nameOverride?: string): string {
  const piece = pieceHeadingBefore(chart)?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  const sectionName =
    chart
      .closest(".pattern-section")
      ?.querySelector(".pattern-section__heading")
      ?.textContent?.replace(/\s+/g, " ")
      .trim() ?? "";
  const ownName =
    nameOverride ||
    chart
      .querySelector(".ns-shaping-chart__title, .ns-visual-guides__card-title, .shaping-map__title, h3, h4")
      ?.textContent?.replace(/\s+/g, " ")
      .trim() ||
    "";
  const name = ownName || sectionName || "Shaping chart";
  const reset = rowCounterResetBefore(chart);
  const counter = reset
    ? "Row counter was reset to RC: 000 before this chart. Readings use that counter."
    : "RC is the row counter for this piece.";
  return [project, piece, name, counter].filter((part) => part.length > 0).join(" · ");
}

function stampChart(chart: HTMLElement, project: string, cleanups: Array<() => void>): void {
  const banner = chart.ownerDocument.createElement("p");
  banner.className = "pattern-print-chart-banner";
  banner.textContent = chartLabel(chart, project);
  chart.insertBefore(banner, chart.firstChild);
  cleanups.push(() => banner.remove());

  chart.querySelectorAll("table").forEach((table) => {
    const head = table.querySelector("thead");
    if (!head) return;
    const panel = table.closest(".ns-shaping-chart__tabpanel, .ns-shaping-chart--second-shoulder, .ns-shaping-chart__print-lead");
    const heading = panel
      ?.querySelector(".ns-shaping-chart__print-lead-heading, .ns-shaping-chart__title, h2, h3")
      ?.textContent?.replace(/\s+/g, " ")
      .trim();
    const row = chart.ownerDocument.createElement("tr");
    row.className = "pattern-print-chart-repeat-banner";
    const cell = chart.ownerDocument.createElement("th");
    cell.colSpan = Math.max(1, head.querySelectorAll("th").length);
    cell.scope = "colgroup";
    cell.textContent = chartLabel(chart, project, heading || undefined);
    row.append(cell);
    head.insertBefore(row, head.firstChild);
    cleanups.push(() => row.remove());
  });
}

function markPieceHeadings(doc: Document, roots: readonly HTMLElement[], cleanups: Array<() => void>): void {
  const pieces = [
    ...doc.querySelectorAll<HTMLElement>(".sleeveless-pattern-piece, .print-piece-title"),
  ];
  for (const piece of pieces) {
    const nextPiece = pieces.find(
      (other) =>
        other !== piece &&
        (piece.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    );
    const hasChart = roots.some((chart) => {
      const afterPiece = (piece.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      const beforeNext =
        !nextPiece || (chart.compareDocumentPosition(nextPiece) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      return afterPiece && beforeNext;
    });
    if (!hasChart) continue;
    piece.classList.add("pattern-print-chart-piece");
    cleanups.push(() => piece.classList.remove("pattern-print-chart-piece"));
  }
}

function markChartSetup(chart: HTMLElement, cleanups: Array<() => void>): void {
  const section = chart.closest(".pattern-section");
  if (!section) return;
  const title = section.querySelector(".pattern-section__heading")?.textContent ?? "";
  const rows = [...section.querySelectorAll<HTMLElement>(".sleeveless-pattern-row, .print-inst-row")];
  const preceding = rows.filter(
    (row) =>
      !row.contains(chart) &&
      (row.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 &&
      !row.querySelector(CHART_SELECTOR),
  );
  const chosen = /neckline|shoulder|chart/i.test(title)
    ? preceding
    : preceding.filter((row) => row.querySelector(".row-counter-reset")).slice(-1);
  for (const row of chosen) {
    row.classList.add("pattern-print-chart-setup");
    cleanups.push(() => row.classList.remove("pattern-print-chart-setup"));
  }
}

function sectionHasWrittenShaping(chart: HTMLElement): boolean {
  return Boolean(chart.closest(".pattern-section")?.querySelector(".pattern-print-written-shaping"));
}

function writtenShapingFollowsInPiece(pointer: HTMLElement): boolean {
  const section = pointer.closest(".pattern-section");
  if (section?.querySelector(".pattern-print-written-shaping")) return true;
  const pieceSelector = ".sleeveless-pattern-piece, .print-piece-title, h2.pattern-piece";
  const pieces = [...(pointer.ownerDocument?.querySelectorAll<HTMLElement>(pieceSelector) ?? [])];
  const piece = [...pieces]
    .reverse()
    .find((item) => (item.compareDocumentPosition(pointer) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0);
  const followingPiece = pieces.find(
    (item) =>
      item !== piece && (pointer.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
  );
  const written = [
    ...(pointer.ownerDocument?.querySelectorAll<HTMLElement>(".pattern-print-written-shaping") ?? []),
  ];
  return written.some((block) => {
    const afterPiece =
      !piece ||
      piece.contains(block) ||
      (piece.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    const beforeNextPiece =
      !followingPiece ||
      (block.compareDocumentPosition(followingPiece) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    return afterPiece && beforeNextPiece;
  });
}

function markUnresolvedPointers(doc: Document, cleanups: Array<() => void>): HTMLElement[] {
  const kept: HTMLElement[] = [];
  doc.querySelectorAll<HTMLElement>(".pattern-print-checklist-pointer").forEach((pointer) => {
    if (writtenShapingFollowsInPiece(pointer)) return;
    const section = pointer.closest<HTMLElement>(".pattern-section");
    pointer.classList.add("pattern-print-unresolved-pointer");
    cleanups.push(() => pointer.classList.remove("pattern-print-unresolved-pointer"));
    if (section && !section.classList.contains("pattern-print-keep-charts")) {
      section.classList.add("pattern-print-keep-charts");
      cleanups.push(() => section.classList.remove("pattern-print-keep-charts"));
      kept.push(section);
    }
  });
  return kept;
}

function hostForAppendix(doc: Document): HTMLElement {
  return (
    doc.querySelector<HTMLElement>("#pattern-content") ??
    doc.querySelector<HTMLElement>("[data-pattern-content]") ??
    doc.body
  );
}

/**
 * Apply a print choice to the live document. Call the returned function after printing
 * so the on-screen pattern is unchanged.
 */
export function applyPatternPrintLayout(doc: Document, choice: PatternPrintChoice): () => void {
  const root = doc.documentElement;
  const previous = root.dataset.patternPrintChoice;
  root.dataset.patternPrintChoice = choice;
  const cleanups: Array<() => void> = [];
  const project = projectTitle(doc);
  const roots = chartRoots(doc);
  markPieceHeadings(doc, roots, cleanups);
  markUnresolvedPointers(doc, cleanups);

  const appendix = doc.createElement("section");
  appendix.className = "pattern-print-charts-appendix";
  appendix.setAttribute("aria-label", "Charts and checklists");
  const heading = doc.createElement("h2");
  heading.className = "pattern-print-charts-appendix__title";
  heading.textContent = "Charts and checklists";
  appendix.append(heading);

  let moved = 0;
  roots.forEach((chart, index) => {
    stampChart(chart, project, cleanups);
    markChartSetup(chart, cleanups);
    const keepInline =
      choice !== "both" ||
      chart.closest(".pattern-print-keep-charts") !== null ||
      (!sectionHasWrittenShaping(chart) &&
        chart.closest(".pattern-section")?.classList.contains("pattern-print-keep-charts") === true);
    if (choice === "charts" && index > 0) {
      chart.classList.add("pattern-print-chart-break");
      cleanups.push(() => chart.classList.remove("pattern-print-chart-break"));
    }
    if (choice !== "both" || keepInline) return;
    const row = chart.closest<HTMLElement>(".sleeveless-pattern-row, .print-inst-row");
    if (
      row &&
      !row.querySelector(
        ".sleeveless-pattern-line:not(.pattern-print-checklist-pointer), .print-line:not(.pattern-print-checklist-pointer), .pattern-print-written-shaping, .sleeveless-pattern-rc, .print-rc, .row-counter-reset",
      )
    ) {
      row.classList.add("pattern-print-chart-only-row");
      cleanups.push(() => row.classList.remove("pattern-print-chart-only-row"));
    }
    const section = chart.closest<HTMLElement>(".pattern-section");
    if (
      section &&
      !section.querySelector(
        ".sleeveless-pattern-line:not(.pattern-print-checklist-pointer), .print-line:not(.pattern-print-checklist-pointer), .pattern-print-written-shaping, .sleeveless-pattern-rc, .print-rc, .row-counter-reset",
      )
    ) {
      section.classList.add("pattern-print-chart-only-section");
      cleanups.push(() => section.classList.remove("pattern-print-chart-only-section"));
    }
    const parent = chart.parentNode;
    if (!parent) return;
    const next = chart.nextSibling;
    const unit = doc.createElement("div");
    unit.className = "pattern-print-chart-unit";
    unit.append(chart);
    appendix.append(unit);
    moved += 1;
    cleanups.push(() => {
      if (next && next.parentNode === parent) parent.insertBefore(chart, next);
      else parent.append(chart);
    });
  });

  if (choice === "both" && moved > 0) {
    hostForAppendix(doc).append(appendix);
    cleanups.push(() => appendix.remove());
  } else if (choice === "charts" && roots.length === 0) {
    const empty = doc.createElement("p");
    empty.className = "pattern-print-charts-empty";
    empty.textContent = "This pattern has no shaping charts or checklists.";
    hostForAppendix(doc).append(empty);
    cleanups.push(() => empty.remove());
  }

  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    for (const cleanup of cleanups.reverse()) cleanup();
    if (previous) root.dataset.patternPrintChoice = previous;
    else delete root.dataset.patternPrintChoice;
  };
}
