/**
 * Basic Socks finished-pattern diagram tabs (Stitches & Rows / Shaping Notation).
 * Thin wrapper around the shared Pattern Diagram tab container and shaping-notation help.
 * Diagram hosts use the shared sweater enlarge card (magnifying-glass + lightbox).
 */

import { buildPatternDiagramShapingNotationHelpHtml } from "../patternDiagramShapingNotationHelp";
import {
  PATTERN_DIAGRAM_TAB_SHAPING,
  PATTERN_DIAGRAM_TAB_STS_ROWS,
  activatePatternDiagramTab,
  buildPatternDiagramTabsShellHtml,
  initPatternDiagramTabs,
  type PatternDiagramTabId,
} from "../patternDiagramTabs";
import { buildSleevelessPatternDiagramEnlargeHostHtml } from "../sleevelessPatternDiagramTabs";

export const SOCK_DIAGRAM_TAB_STS_ROWS = PATTERN_DIAGRAM_TAB_STS_ROWS;
export const SOCK_DIAGRAM_TAB_SHAPING = PATTERN_DIAGRAM_TAB_SHAPING;

export type SockDiagramTabId = PatternDiagramTabId;

export const SOCK_DIAGRAM_STS_ROWS_ALT = "Basic Socks stitches and rows";
export const SOCK_DIAGRAM_SHAPING_ALT = "Basic Socks shaping notation";

const SOCK_TAB_BIND_OPTIONS = {
  tabAttr: "data-sock-diagram-tab",
  panelAttr: "data-sock-diagram-panel",
  rootAttr: "data-sock-diagram-tabs",
  initAttr: "data-sock-diagram-tabs-init",
} as const;

function buildSockDiagramHostHtml(mode: SockDiagramTabId): string {
  const isShaping = mode === SOCK_DIAGRAM_TAB_SHAPING;
  const hostAttr = isShaping ? "data-sock-diagram-shaping-host" : "data-sock-diagram-sts-rows-host";
  const alt = isShaping ? SOCK_DIAGRAM_SHAPING_ALT : SOCK_DIAGRAM_STS_ROWS_ALT;
  return buildSleevelessPatternDiagramEnlargeHostHtml({
    alt,
    innerHostHtml:
      `<div class="sock-pattern-diagram-panel__svg sleeveless-piece-split__diagram-svg sleeveless-pattern-diagram-panel__svg" ${hostAttr}></div>`,
  });
}

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
        panelHtml: buildSockDiagramHostHtml(SOCK_DIAGRAM_TAB_STS_ROWS),
      },
      {
        id: SOCK_DIAGRAM_TAB_SHAPING,
        printHeading: true,
        panelHtml: buildPatternDiagramShapingNotationHelpHtml() + buildSockDiagramHostHtml(SOCK_DIAGRAM_TAB_SHAPING),
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
