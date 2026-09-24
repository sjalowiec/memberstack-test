/**
 * Sideways V-Neck finished-pattern diagram tabs.
 * Thin wrapper around the shared Pattern Diagram tab container.
 * Sideways supplies its diagram hosts; shared code owns tab semantics and chrome.
 */

import { buildPatternDiagramShapingNotationHelpHtml } from "./patternDiagramShapingNotationHelp";
import {
  PATTERN_DIAGRAM_TAB_SHAPING,
  PATTERN_DIAGRAM_TAB_STS_ROWS,
  activatePatternDiagramTab,
  buildPatternDiagramTabsShellHtml,
  initPatternDiagramTabs,
  type PatternDiagramTabId,
} from "./patternDiagramTabs";
import { buildSleevelessPatternDiagramEnlargeHostHtml } from "./sleevelessPatternDiagramTabs";

export const SIDEWAYS_DIAGRAM_TAB_STS_ROWS = PATTERN_DIAGRAM_TAB_STS_ROWS;
export const SIDEWAYS_DIAGRAM_TAB_SHAPING = PATTERN_DIAGRAM_TAB_SHAPING;

export type SidewaysDiagramTabId = PatternDiagramTabId;

export const SIDEWAYS_DIAGRAM_PANEL_TITLE = "Garment Dimensions";
export const SIDEWAYS_DIAGRAM_STS_ROWS_ALT = "Sideways V-Neck stitches and rows";
export const SIDEWAYS_DIAGRAM_SHAPING_ALT = "Sideways V-Neck shaping notation";

const SIDEWAYS_TAB_BIND_OPTIONS = {
  tabAttr: "data-sideways-diagram-tab",
  panelAttr: "data-sideways-diagram-panel",
  rootAttr: "data-sideways-diagram-tabs",
  initAttr: "data-sideways-diagram-tabs-init",
} as const;

const SIDEWAYS_SLEEVE_TAB_BIND_OPTIONS = {
  tabAttr: "data-sideways-sleeve-diagram-tab",
  panelAttr: "data-sideways-sleeve-diagram-panel",
  rootAttr: "data-sideways-sleeve-diagram-tabs",
  initAttr: "data-sideways-sleeve-diagram-tabs-init",
} as const;

function buildSidewaysDiagramHostHtml(mode: SidewaysDiagramTabId): string {
  const isShaping = mode === SIDEWAYS_DIAGRAM_TAB_SHAPING;
  const hostAttr = isShaping
    ? "data-sideways-diagram-shaping-host"
    : "data-sideways-diagram-sts-rows-host";
  const alt = isShaping ? SIDEWAYS_DIAGRAM_SHAPING_ALT : SIDEWAYS_DIAGRAM_STS_ROWS_ALT;
  return buildSleevelessPatternDiagramEnlargeHostHtml({
    alt,
    innerHostHtml:
      `<div class="sideways-pattern-diagram-panel__svg sleeveless-piece-split__diagram-svg sleeveless-pattern-diagram-panel__svg" ${hostAttr}></div>`,
  });
}

export function buildSidewaysCardiganPatternDiagramTabsShellHtml(): string {
  return buildPatternDiagramTabsShellHtml({
    idPrefix: "sideways-diagram",
    tablistLabel: "Sideways diagram view",
    extraRootClass: "sideways-pattern-diagram-tabs",
    extraRootAttrs: "data-sideways-diagram-tabs",
    extraListClass: "sideways-pattern-diagram-tabs__list",
    extraTabClass: "sideways-pattern-diagram-tabs__tab",
    extraPanelClass: "sideways-pattern-diagram-tabs__panel",
    testId: "sideways-diagram-tabs",
    tabTestIdPrefix: "sideways-diagram-tab",
    panelTestIdPrefix: "sideways-diagram-panel",
    tabAttrAliases: ["data-sideways-diagram-tab"],
    panelAttrAliases: ["data-sideways-diagram-panel"],
    printHeadingClass: "sideways-pattern-diagram-print-heading",
    tabs: [
      {
        id: SIDEWAYS_DIAGRAM_TAB_STS_ROWS,
        printHeading: true,
        panelHtml: buildSidewaysDiagramHostHtml(SIDEWAYS_DIAGRAM_TAB_STS_ROWS),
      },
      {
        id: SIDEWAYS_DIAGRAM_TAB_SHAPING,
        printHeading: true,
        panelHtml:
          buildPatternDiagramShapingNotationHelpHtml() +
          buildSidewaysDiagramHostHtml(SIDEWAYS_DIAGRAM_TAB_SHAPING),
      },
    ],
  });
}

export const SIDEWAYS_SLEEVE_DIAGRAM_STS_ROWS_ALT = "Sideways sleeve stitches and rows";
export const SIDEWAYS_SLEEVE_DIAGRAM_SHAPING_ALT = "Sideways sleeve shaping notation";

function buildSidewaysSleeveDiagramHostHtml(mode: SidewaysDiagramTabId): string {
  const isShaping = mode === SIDEWAYS_DIAGRAM_TAB_SHAPING;
  const hostAttr = isShaping
    ? "data-sideways-sleeve-diagram-shaping-host"
    : "data-sideways-sleeve-diagram-sts-rows-host";
  const alt = isShaping ? SIDEWAYS_SLEEVE_DIAGRAM_SHAPING_ALT : SIDEWAYS_SLEEVE_DIAGRAM_STS_ROWS_ALT;
  return buildSleevelessPatternDiagramEnlargeHostHtml({
    alt,
    innerHostHtml:
      `<div class="sideways-pattern-diagram-panel__svg sleeveless-piece-split__diagram-svg sleeveless-pattern-diagram-panel__svg" ${hostAttr}></div>`,
  });
}

/** Sleeve piece tabs. Separate ids from the body Garment Dimensions tabs. */
export function buildSidewaysCardiganSleeveDiagramTabsShellHtml(): string {
  return buildPatternDiagramTabsShellHtml({
    idPrefix: "sideways-sleeve-diagram",
    tablistLabel: "Sleeve diagram view",
    extraRootClass: "sideways-pattern-diagram-tabs sideways-sleeve-diagram-tabs",
    extraRootAttrs: "data-sideways-sleeve-diagram-tabs",
    extraListClass: "sideways-pattern-diagram-tabs__list",
    extraTabClass: "sideways-pattern-diagram-tabs__tab",
    extraPanelClass: "sideways-pattern-diagram-tabs__panel",
    testId: "sideways-sleeve-diagram-tabs",
    tabTestIdPrefix: "sideways-sleeve-diagram-tab",
    panelTestIdPrefix: "sideways-sleeve-diagram-panel",
    tabAttrAliases: ["data-sideways-sleeve-diagram-tab"],
    panelAttrAliases: ["data-sideways-sleeve-diagram-panel"],
    printHeadingClass: "sideways-pattern-diagram-print-heading",
    tabs: [
      {
        id: SIDEWAYS_DIAGRAM_TAB_STS_ROWS,
        printHeading: true,
        panelHtml: buildSidewaysSleeveDiagramHostHtml(SIDEWAYS_DIAGRAM_TAB_STS_ROWS),
      },
      {
        id: SIDEWAYS_DIAGRAM_TAB_SHAPING,
        printHeading: true,
        panelHtml:
          buildPatternDiagramShapingNotationHelpHtml() +
          buildSidewaysSleeveDiagramHostHtml(SIDEWAYS_DIAGRAM_TAB_SHAPING),
      },
    ],
  });
}

export function activateSidewaysDiagramTab(
  root: ParentNode,
  tabIdValue: SidewaysDiagramTabId,
  options?: { focus?: boolean },
): void {
  activatePatternDiagramTab(root, tabIdValue, {
    ...SIDEWAYS_TAB_BIND_OPTIONS,
    focus: options?.focus,
  });
}

export function initSidewaysCardiganPatternDiagramTabs(root: ParentNode = document): void {
  initPatternDiagramTabs(root, SIDEWAYS_TAB_BIND_OPTIONS);
}

export function initSidewaysCardiganSleeveDiagramTabs(root: ParentNode = document): void {
  initPatternDiagramTabs(root, SIDEWAYS_SLEEVE_TAB_BIND_OPTIONS);
}
