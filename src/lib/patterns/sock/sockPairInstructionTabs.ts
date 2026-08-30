/**
 * Sock 1 / Sock 2 instruction selector. Presentation only — both documents
 * are already generated. Screen shows one; print reveals both.
 */

import {
  activatePatternDiagramTab,
  buildPatternDiagramTabsShellHtml,
  initPatternDiagramTabs,
} from "../patternDiagramTabs";
import {
  renderBasicSockInstructionsHtml,
  type SockInstructionDocument,
} from "./sockInstructions";

export const SOCK_PAIR_TAB_SOCK_1 = "sock-1" as const;
export const SOCK_PAIR_TAB_SOCK_2 = "sock-2" as const;

const SOCK_PAIR_BIND_OPTIONS = {
  tabAttr: "data-socks-pair-tab",
  panelAttr: "data-socks-pair-panel",
  rootAttr: "data-socks-pair-tabs",
  initAttr: "data-socks-pair-tabs-init",
} as const;

export function buildSockPairInstructionTabsHtml(
  sock1: SockInstructionDocument,
  sock2: SockInstructionDocument,
): string {
  return buildPatternDiagramTabsShellHtml({
    idPrefix: "socks-pair",
    tablistLabel: "Sock of pair",
    selectedId: SOCK_PAIR_TAB_SOCK_1,
    extraRootClass: "socks-pair-tabs",
    extraRootAttrs: "data-socks-pair-tabs",
    extraListClass: "socks-pair-tabs__list",
    extraTabClass: "socks-pair-tabs__tab",
    extraPanelClass: "socks-pair-tabs__panel",
    testId: "socks-pair-tabs",
    tabTestIdPrefix: "socks-pair-tab",
    panelTestIdPrefix: "socks-pair-panel",
    tabAttrAliases: ["data-socks-pair-tab"],
    panelAttrAliases: ["data-socks-pair-panel"],
    printHeadingClass: "socks-pair-print-heading",
    tabs: [
      {
        id: SOCK_PAIR_TAB_SOCK_1,
        label: "Sock 1",
        printHeading: true,
        panelHtml: renderBasicSockInstructionsHtml(sock1),
      },
      {
        id: SOCK_PAIR_TAB_SOCK_2,
        label: "Sock 2",
        printHeading: true,
        panelHtml: renderBasicSockInstructionsHtml(sock2),
      },
    ],
  });
}

export function initSockPairInstructionTabs(root: ParentNode = document): void {
  initPatternDiagramTabs(root, SOCK_PAIR_BIND_OPTIONS);
}

export function selectedSockPairTab(root: ParentNode): "sock-1" | "sock-2" {
  const selected = root.querySelector<HTMLElement>(
    `[${SOCK_PAIR_BIND_OPTIONS.tabAttr}][aria-selected="true"]`,
  );
  const id = selected?.getAttribute(SOCK_PAIR_BIND_OPTIONS.tabAttr);
  return id === SOCK_PAIR_TAB_SOCK_2 ? SOCK_PAIR_TAB_SOCK_2 : SOCK_PAIR_TAB_SOCK_1;
}

export function activateSockPairTab(root: ParentNode, tabId: "sock-1" | "sock-2"): void {
  activatePatternDiagramTab(root, tabId, SOCK_PAIR_BIND_OPTIONS);
}
