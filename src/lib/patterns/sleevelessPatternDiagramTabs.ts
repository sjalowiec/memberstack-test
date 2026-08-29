/**
 * Sleeveless finished-pattern diagram tabs.
 * Thin wrapper around the shared Pattern Diagram tab container.
 * Sleeveless supplies existing schematic / notation hosts; shared code owns tab semantics.
 */

import { SHAPING_NOTATION_CHART_HELP_VIMEO_ID } from "../glossary/shapingNotationGlossary";
import {
  PATTERN_DIAGRAM_TAB_SHAPING,
  PATTERN_DIAGRAM_TAB_STS_ROWS,
  activatePatternDiagramTab,
  buildPatternDiagramTabsShellHtml,
  initPatternDiagramTabs,
  type PatternDiagramTabId,
} from "./patternDiagramTabs";

export const SLEEVELESS_DIAGRAM_TAB_STS_ROWS = PATTERN_DIAGRAM_TAB_STS_ROWS;
export const SLEEVELESS_DIAGRAM_TAB_SHAPING = PATTERN_DIAGRAM_TAB_SHAPING;

export type SleevelessDiagramTabId = PatternDiagramTabId;
export type SleevelessDiagramTabsPiece = "back" | "front" | "sleeve";

export const SLEEVELESS_DIAGRAM_TAB_IDS: readonly SleevelessDiagramTabId[] = [
  SLEEVELESS_DIAGRAM_TAB_STS_ROWS,
  SLEEVELESS_DIAGRAM_TAB_SHAPING,
] as const;

export const SLEEVELESS_DIAGRAM_TAB_LABELS: Record<SleevelessDiagramTabId, string> = {
  [SLEEVELESS_DIAGRAM_TAB_STS_ROWS]: "Stitches & Rows",
  [SLEEVELESS_DIAGRAM_TAB_SHAPING]: "Shaping Notation",
};

export const SLEEVELESS_DIAGRAM_PANEL_TITLE = "Garment Dimensions";

export const SLEEVELESS_SHAPING_NOTATION_HELP_LABEL = "How to Read Shaping Notation";
export const SLEEVELESS_SHAPING_NOTATION_HELP_VIMEO_ID = SHAPING_NOTATION_CHART_HELP_VIMEO_ID;

const SLEEVELESS_TAB_BIND_OPTIONS = {
  tabAttr: "data-sleeveless-diagram-tab",
  panelAttr: "data-sleeveless-diagram-panel",
  rootAttr: "data-sleeveless-diagram-tabs",
  initAttr: "data-sleeveless-diagram-tabs-init",
} as const;

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildSleevelessShapingNotationHelpHtml(): string {
  const label = escapeHtml(SLEEVELESS_SHAPING_NOTATION_HELP_LABEL);
  const vimeoId = escapeHtml(SLEEVELESS_SHAPING_NOTATION_HELP_VIMEO_ID);
  return (
    `<p class="sleeveless-pattern-diagram-shaping-help no-print" data-sleeveless-diagram-shaping-help>` +
    `<button type="button" class="kbm-btn kbm-btn-outline sleeveless-pattern-diagram-shaping-help__btn"` +
    ` data-sleeveless-video-id="${vimeoId}"` +
    ` data-video-title="${label}"` +
    ` data-testid="sleeveless-shaping-notation-help"` +
    ` aria-haspopup="dialog">` +
    `<i class="fa-solid fa-circle-info" aria-hidden="true"></i>` +
    `<span>${label}</span>` +
    `</button>` +
    `</p>`
  );
}

export type BuildSleevelessDiagramHostOptions = {
  piece: SleevelessDiagramTabsPiece;
  mode: SleevelessDiagramTabId;
  src: string;
  alt: string;
  cardiganHalfSide?: "left" | "right";
};

/**
 * Existing enlarge + SVG host card. Hydration still uses `data-sleeveless-diagram`
 * plus the back/front mode attrs — only the tab shell is new.
 */
export function buildSleevelessPatternDiagramHostHtml(
  options: BuildSleevelessDiagramHostOptions,
): string {
  const src = escapeHtml(options.src);
  const alt = escapeHtml(options.alt);
  const hostAttr =
    options.mode === SLEEVELESS_DIAGRAM_TAB_SHAPING
      ? "data-sleeveless-diagram-shaping-host"
      : "data-sleeveless-diagram-sts-rows-host";
  const pieceModeAttr =
    options.piece === "back"
      ? ` data-sleeveless-back-diagram data-sleeveless-back-diagram-mode="${options.mode}"`
      : options.piece === "sleeve"
        ? ` data-sleeveless-sleeve-diagram data-sleeveless-sleeve-diagram-mode="${options.mode}"`
        : ` data-sleeveless-front-diagram data-sleeveless-front-diagram-mode="${options.mode}"`;
  const half = options.cardiganHalfSide;
  const halfAttr =
    half === "left" || half === "right" ? ` data-sleeveless-cardigan-half="${half}"` : "";

  return (
    `<div class="sleeveless-piece-split__diagram-card">` +
    `<button type="button" class="sleeveless-piece-split__diagram-enlarge-btn no-print" data-sleeveless-diagram-enlarge aria-label="Enlarge diagram">` +
    `<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>` +
    `</button>` +
    `<button type="button" class="sleeveless-piece-split__diagram-trigger" data-sleeveless-diagram-trigger aria-label="Open larger diagram: ${alt}">` +
    `<div class="sleeveless-piece-split__diagram-svg sleeveless-pattern-diagram-panel__svg" data-sleeveless-diagram ${hostAttr} data-src="${src}" data-alt="${alt}"${pieceModeAttr}${halfAttr}>` +
    `<p class="sleeveless-pattern-boot-msg">Loading diagram…</p>` +
    `</div>` +
    `</button>` +
    `</div>`
  );
}

export type BuildSleevelessPatternDiagramTabsOptions = {
  piece: SleevelessDiagramTabsPiece;
  stsRowsSrc: string;
  stsRowsAlt: string;
  shapingSrc: string;
  shapingAlt: string;
  cardiganHalfSide?: "left" | "right";
};

/**
 * Static shell HTML for the Sleeveless visual workspace.
 * Both existing SVGs are mounted up front; tab clicks only toggle visibility.
 */
export function buildSleevelessPatternDiagramTabsShellHtml(
  options: BuildSleevelessPatternDiagramTabsOptions,
): string {
  const idPrefix = `sleeveless-${options.piece}-diagram`;
  const tablistLabel =
    options.piece === "back"
      ? "Back diagram view"
      : options.piece === "sleeve"
        ? "Sleeve diagram view"
        : "Front diagram view";
  const helpHtml = buildSleevelessShapingNotationHelpHtml();

  return buildPatternDiagramTabsShellHtml({
    idPrefix,
    tablistLabel,
    extraRootClass: "sleeveless-pattern-diagram-tabs",
    extraRootAttrs: "data-sleeveless-diagram-tabs",
    extraListClass: "sleeveless-pattern-diagram-tabs__list",
    extraTabClass: "sleeveless-pattern-diagram-tabs__tab",
    extraPanelClass: "sleeveless-pattern-diagram-tabs__panel",
    testId: `${idPrefix}-tabs`,
    tabTestIdPrefix: `${idPrefix}-tab`,
    panelTestIdPrefix: `${idPrefix}-panel`,
    tabAttrAliases: ["data-sleeveless-diagram-tab"],
    panelAttrAliases: ["data-sleeveless-diagram-panel"],
    printHeadingClass: "sleeveless-pattern-diagram-print-heading",
    tabs: [
      {
        id: SLEEVELESS_DIAGRAM_TAB_STS_ROWS,
        printHeading: true,
        panelHtml: buildSleevelessPatternDiagramHostHtml({
          piece: options.piece,
          mode: SLEEVELESS_DIAGRAM_TAB_STS_ROWS,
          src: options.stsRowsSrc,
          alt: options.stsRowsAlt,
          cardiganHalfSide: options.cardiganHalfSide,
        }),
      },
      {
        id: SLEEVELESS_DIAGRAM_TAB_SHAPING,
        printHeading: true,
        panelHtml:
          helpHtml +
          buildSleevelessPatternDiagramHostHtml({
            piece: options.piece,
            mode: SLEEVELESS_DIAGRAM_TAB_SHAPING,
            src: options.shapingSrc,
            alt: options.shapingAlt,
            cardiganHalfSide: options.cardiganHalfSide,
          }),
      },
    ],
  });
}

export function activateSleevelessDiagramTab(
  root: ParentNode,
  tabIdValue: SleevelessDiagramTabId,
  options?: { focus?: boolean },
): void {
  activatePatternDiagramTab(root, tabIdValue, {
    ...SLEEVELESS_TAB_BIND_OPTIONS,
    focus: options?.focus,
  });
}

/**
 * Bind click + keyboard navigation once per Sleeveless tabs root.
 */
export function initSleevelessPatternDiagramTabs(root: ParentNode = document): void {
  initPatternDiagramTabs(root, SLEEVELESS_TAB_BIND_OPTIONS);
}
