/**
 * Hat finished-pattern diagram tabs.
 * Thin wrapper around the shared Pattern Diagram tab container.
 * Hat supplies its diagram hosts; shared code owns tab semantics and chrome.
 */

import { buildHatShapingNotationHelpHtml } from "./hatShapingNotationHelp";
import {
  PATTERN_DIAGRAM_TAB_SHAPING,
  PATTERN_DIAGRAM_TAB_STS_ROWS,
  activatePatternDiagramTab,
  buildPatternDiagramTabsShellHtml,
  initPatternDiagramTabs,
  type PatternDiagramTabId,
} from "../patternDiagramTabs";

export const HAT_DIAGRAM_TAB_STS_ROWS = PATTERN_DIAGRAM_TAB_STS_ROWS;
export const HAT_DIAGRAM_TAB_SHAPING = PATTERN_DIAGRAM_TAB_SHAPING;

/** @deprecated Use {@link HAT_DIAGRAM_TAB_SHAPING}. */
export const HAT_DIAGRAM_TAB_JAPANESE = HAT_DIAGRAM_TAB_SHAPING;

export type HatDiagramTabId = PatternDiagramTabId;

export const HAT_DIAGRAM_TAB_IDS: readonly HatDiagramTabId[] = [
  HAT_DIAGRAM_TAB_STS_ROWS,
  HAT_DIAGRAM_TAB_SHAPING,
] as const;

export const HAT_DIAGRAM_TAB_LABELS: Record<HatDiagramTabId, string> = {
  [HAT_DIAGRAM_TAB_STS_ROWS]: "Stitches & Rows",
  [HAT_DIAGRAM_TAB_SHAPING]: "Shaping Notation",
};

const HAT_TAB_BIND_OPTIONS = {
  tabAttr: "data-hat-diagram-tab",
  panelAttr: "data-hat-diagram-panel",
  rootAttr: "data-hat-diagram-tabs",
  initAttr: "data-hat-diagram-tabs-init",
} as const;

/**
 * Static shell HTML for the diagram panel. SVG hosts are filled by the pattern page.
 */
export function buildHatPatternDiagramTabsShellHtml(): string {
  const helpHtml = buildHatShapingNotationHelpHtml();

  return buildPatternDiagramTabsShellHtml({
    idPrefix: "hat-diagram",
    tablistLabel: "Hat diagram view",
    extraRootClass: "hat-pattern-diagram-tabs",
    extraRootAttrs: "data-hat-diagram-tabs",
    extraListClass: "hat-pattern-diagram-tabs__list",
    extraTabClass: "hat-pattern-diagram-tabs__tab",
    extraPanelClass: "hat-pattern-diagram-tabs__panel",
    testId: "hat-diagram-tabs",
    tabTestIdPrefix: "hat-diagram-tab",
    panelTestIdPrefix: "hat-diagram-panel",
    tabAttrAliases: ["data-hat-diagram-tab"],
    panelAttrAliases: ["data-hat-diagram-panel"],
    printHeadingClass: "hat-pattern-diagram-print-heading",
    tabs: [
      {
        id: HAT_DIAGRAM_TAB_STS_ROWS,
        printHeading: true,
        panelHtml:
          `<div class="hat-pattern-diagram-panel__svg" data-hat-diagram-sts-rows-host data-hat-diagram-host></div>`,
      },
      {
        id: HAT_DIAGRAM_TAB_SHAPING,
        printHeading: true,
        panelHtml:
          helpHtml +
          `<div class="hat-pattern-diagram-panel__svg" data-hat-diagram-shaping-host></div>`,
      },
    ],
  });
}

export function activateHatDiagramTab(
  root: ParentNode,
  tabIdValue: HatDiagramTabId,
  options?: { focus?: boolean },
): void {
  activatePatternDiagramTab(root, tabIdValue, {
    ...HAT_TAB_BIND_OPTIONS,
    focus: options?.focus,
  });
}

/**
 * Bind click + keyboard navigation once per tabs root.
 */
export function initHatPatternDiagramTabs(root: ParentNode = document): void {
  initPatternDiagramTabs(root, HAT_TAB_BIND_OPTIONS);
}
