/**
 * Basic Socks finished-pattern diagram tabs (Stitches & Rows / Shaping Notation).
 * Thin wrapper around the shared Pattern Diagram tab container.
 */

import {
  PATTERN_DIAGRAM_TAB_SHAPING,
  PATTERN_DIAGRAM_TAB_STS_ROWS,
  activatePatternDiagramTab,
  buildPatternDiagramTabsShellHtml,
  initPatternDiagramTabs,
  type PatternDiagramTabId,
} from "../patternDiagramTabs";

export const SOCK_DIAGRAM_TAB_STS_ROWS = PATTERN_DIAGRAM_TAB_STS_ROWS;
export const SOCK_DIAGRAM_TAB_SHAPING = PATTERN_DIAGRAM_TAB_SHAPING;

export type SockDiagramTabId = PatternDiagramTabId;

const SOCK_TAB_BIND_OPTIONS = {
  tabAttr: "data-sock-diagram-tab",
  panelAttr: "data-sock-diagram-panel",
  rootAttr: "data-sock-diagram-tabs",
  initAttr: "data-sock-diagram-tabs-init",
} as const;

export function buildSockPatternDiagramTabsShellHtml(): string {
  return buildPatternDiagramTabsShellHtml({
    idPrefix: "sock-diagram",
    tablistLabel: "Socks diagram view",
    extraRootClass: "sock-pattern-diagram-tabs",
    extraRootAttrs: "data-sock-diagram-tabs",
    extraListClass: "sock-pattern-diagram-tabs__list",
    extraTabClass: "sock-pattern-diagram-tabs__tab",
    extraPanelClass: "sock-pattern-diagram-tabs__panel",
    testId: "sock-diagram-tabs",
    tabTestIdPrefix: "sock-diagram-tab",
    panelTestIdPrefix: "sock-diagram-panel",
    tabAttrAliases: ["data-sock-diagram-tab"],
    panelAttrAliases: ["data-sock-diagram-panel"],
    printHeadingClass: "sock-pattern-diagram-print-heading",
    tabs: [
      {
        id: SOCK_DIAGRAM_TAB_STS_ROWS,
        printHeading: true,
        panelHtml:
          `<div class="sock-pattern-diagram-panel__svg" data-sock-diagram-sts-rows-host></div>`,
      },
      {
        id: SOCK_DIAGRAM_TAB_SHAPING,
        printHeading: true,
        panelHtml:
          `<div class="sock-pattern-diagram-panel__svg" data-sock-diagram-shaping-host></div>`,
      },
    ],
  });
}

export function initSockPatternDiagramTabs(root: ParentNode = document): void {
  initPatternDiagramTabs(root, SOCK_TAB_BIND_OPTIONS);
}

export function activateSockDiagramTab(root: ParentNode, tabId: SockDiagramTabId): void {
  activatePatternDiagramTab(root, tabId, SOCK_TAB_BIND_OPTIONS);
}
