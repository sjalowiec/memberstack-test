/**
 * Finished-mitten Garment Dimensions tabs.
 * Same shell, enlarge card, and shaping-notation help as the sweater diagrams.
 * Both drawings are in the instruction HTML so print does not wait for a second render.
 */

import { SLEEVELESS_DIAGRAM_INLINE_CLASS } from "../sleevelessDiagramModal";
import { buildPatternDiagramShapingNotationHelpHtml } from "../patternDiagramShapingNotationHelp";
import {
  PATTERN_DIAGRAM_TAB_SHAPING,
  PATTERN_DIAGRAM_TAB_STS_ROWS,
  buildPatternDiagramTabsShellHtml,
} from "../patternDiagramTabs";
import { buildSleevelessPatternDiagramEnlargeHostHtml } from "../sleevelessPatternDiagramTabs";
import { buildMittenDiagramSvg } from "./mittenDiagramSvg";
import { buildMittenShapingNotationSvg } from "./mittenShapingNotationDiagramSvg";
import type { MittenSlotEdge } from "./mittenInstructions";
import type { MittenCalc } from "./mittenMath";

function inlineSvg(svg: string): string {
  return svg.replace("<svg ", `<svg class="${SLEEVELESS_DIAGRAM_INLINE_CLASS}" `);
}

function diagramHost(mode: "sts-rows" | "shaping-notation", svg: string, alt: string): string {
  const hostAttr =
    mode === "shaping-notation" ? "data-mitten-diagram-shaping-host" : "data-mitten-diagram-sts-rows-host";
  return buildSleevelessPatternDiagramEnlargeHostHtml({
    alt,
    innerHostHtml:
      `<div class="sleeveless-piece-split__diagram-svg sleeveless-pattern-diagram-panel__svg" ${hostAttr} data-alt="${alt}">` +
      inlineSvg(svg) +
      `</div>`,
  });
}

export function buildMittenDiagramTabsHtml(calc: MittenCalc, slotEdge: MittenSlotEdge): string {
  const idPrefix = `mitten-${slotEdge}-diagram`;
  const stsAlt = "Mitten stitches and rows";
  const shapingAlt = "Mitten shaping notation";
  return buildPatternDiagramTabsShellHtml({
    idPrefix,
    tablistLabel: "Mitten diagram view",
    extraRootClass: "sleeveless-pattern-diagram-tabs",
    extraRootAttrs: "data-mitten-diagram-tabs",
    extraListClass: "sleeveless-pattern-diagram-tabs__list",
    extraTabClass: "sleeveless-pattern-diagram-tabs__tab",
    extraPanelClass: "sleeveless-pattern-diagram-tabs__panel",
    testId: `${idPrefix}-tabs`,
    tabTestIdPrefix: `${idPrefix}-tab`,
    panelTestIdPrefix: `${idPrefix}-panel`,
    printHeadingClass: "sleeveless-pattern-diagram-print-heading",
    tabs: [
      {
        id: PATTERN_DIAGRAM_TAB_STS_ROWS,
        printHeading: true,
        panelHtml: diagramHost(
          "sts-rows",
          buildMittenDiagramSvg(calc, slotEdge),
          stsAlt,
        ),
      },
      {
        id: PATTERN_DIAGRAM_TAB_SHAPING,
        printHeading: true,
        panelHtml:
          buildPatternDiagramShapingNotationHelpHtml() +
          diagramHost(
            "shaping-notation",
            buildMittenShapingNotationSvg(calc, slotEdge),
            shapingAlt,
          ),
      },
    ],
  });
}
