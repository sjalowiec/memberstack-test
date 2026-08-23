/**
 * Inline garment schematic for print — replaces SVG placeholders using {@link SleevelessBackPatternResult.debug}
 * (same approach as the interactive pattern tab; no pattern math here).
 */

import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";
import {
  injectBodyShapeGuidesIntoGarmentSvg,
  scaleDiagramGuidesForCardiganHalf,
  type SleevelessGarmentDiagramLayout,
} from "./sleevelessBodyShapeDiagramGuides";
import { buildSleevelessGarmentDiagramReplacements } from "./sleevelessGarmentDiagramReplacements";
import { applyGarmentDiagramSvgReplacements } from "./sleevelessGarmentDiagramSvg";
import { buildSleevelessGarmentDiagramPatternData } from "./sleevelessPatternBuilderMerge";
import { resolveSleevelessBackDiagramSrc } from "./sleevelessBackDiagramSrc";
import {
  isSleevelessCardiganHalfFrontDiagramType,
  resolveCardiganHalfSideForGarmentDiagram,
  resolveSleevelessFrontDiagram,
} from "./sleevelessFrontDiagramSrc";
import { tryBuildLiveSleevelessFrontStsRowsDiagramSvg } from "./sleevelessFrontStsRowsDiagramSvg";

async function fetchSvgWithReplacements(src: string, replacements: Record<string, string>): Promise<string> {
  if (import.meta.env.DEV) {
    console.log("[sleeveless] Garment schematic SVG fetch (print):", src);
  }
  const res = await fetch(src, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Failed to load SVG: ${src} (${res.status})`);
  const svgText = await res.text();
  return applyGarmentDiagramSvgReplacements(svgText, replacements);
}

/** Returns SVG markup (single root `<svg>`) ready for `innerHTML`, with placeholders filled from `result.debug`. */
export async function loadSleevelessBackDiagramSvgMarkup(
  result: SleevelessBackPatternResult,
  patternData: Record<string, unknown>,
  unit: "cm" | "in",
): Promise<string> {
  return loadSleevelessPieceDiagramSvgMarkup(result, patternData, unit, "back");
}

export type LoadSleevelessFrontDiagramSvgMarkupOptions = {
  devForceCardiganHalfLeft?: boolean;
  /** When set, diagram variant selection matches {@link generateSleevelessBackPattern} input. */
  generatorPatternData?: Record<string, unknown>;
};

/** Returns FRONT schematic SVG markup with generated front measurement values. */
export async function loadSleevelessFrontDiagramSvgMarkup(
  result: SleevelessBackPatternResult,
  patternData: Record<string, unknown>,
  unit: "cm" | "in",
  options?: LoadSleevelessFrontDiagramSvgMarkupOptions,
): Promise<string> {
  return loadSleevelessPieceDiagramSvgMarkup(result, patternData, unit, "front", options);
}

async function loadSleevelessPieceDiagramSvgMarkup(
  result: SleevelessBackPatternResult,
  patternData: Record<string, unknown>,
  unit: "cm" | "in",
  piece: "back" | "front",
  frontOpts?: LoadSleevelessFrontDiagramSvgMarkupOptions,
): Promise<string> {
  const diagramPatternData = buildSleevelessGarmentDiagramPatternData(
    patternData,
    frontOpts?.generatorPatternData,
  );
  let replacements: Record<string, string>;
  let src: string;
  let ariaLabel: string;
  let cardiganHalfSide: "left" | "right" | undefined;

  if (piece === "back") {
    replacements = buildSleevelessGarmentDiagramReplacements(result, unit, {
      patternData: diagramPatternData,
      measurementPiece: "back",
    });
    src = resolveSleevelessBackDiagramSrc("sts-rows", diagramPatternData);
    ariaLabel = "Back piece schematic with key measurements";
  } else {
    const frontRes = resolveSleevelessFrontDiagram(diagramPatternData, {
      devForceCardiganHalfLeft: frontOpts?.devForceCardiganHalfLeft,
    });
    cardiganHalfSide = resolveCardiganHalfSideForGarmentDiagram(frontRes, diagramPatternData);
    replacements = buildSleevelessGarmentDiagramReplacements(result, unit, {
      patternData: diagramPatternData,
      measurementPiece: "front",
      cardiganHalfSide,
    });
    const generatedSvg = tryBuildLiveSleevelessFrontStsRowsDiagramSvg(result, diagramPatternData);
    if (generatedSvg) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(generatedSvg, "image/svg+xml");
      const svg = doc.documentElement;
      if (!svg || svg.nodeName.toLowerCase() !== "svg") {
        const pe = doc.querySelector("parsererror");
        throw new Error(pe?.textContent || "SVG parse error");
      }
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", "Front piece schematic with key measurements");
      svg.classList.add("print-back-diagram-svg");
      return svg.outerHTML;
    }
    src = frontRes.src;
    const isCardigan = frontRes.garmentStyle === "cardigan";
    const isHalfFront = isSleevelessCardiganHalfFrontDiagramType(frontRes.diagramType);
    const isCardiganV =
      frontRes.diagramType === "cardiganFullFrontV" || frontRes.diagramType === "cardiganHalfFrontV";
    ariaLabel = isCardigan
      ? isHalfFront && cardiganHalfSide === "left"
        ? isCardiganV
          ? "Cardigan V-neck left front schematic with key measurements (development)"
          : "Cardigan left front schematic with key measurements (development)"
        : isHalfFront && cardiganHalfSide === "right"
          ? isCardiganV
            ? "Cardigan V-neck right front schematic with key measurements (development)"
            : "Cardigan right front schematic with key measurements (development)"
          : isCardiganV
            ? "Cardigan V-neck front schematic with key measurements"
            : "Cardigan front schematic with key measurements"
      : "Front piece schematic with key measurements";
  }

  const raw = await fetchSvgWithReplacements(src, replacements);
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "image/svg+xml");
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg") {
    const pe = doc.querySelector("parsererror");
    throw new Error(pe?.textContent || "SVG parse error");
  }
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", ariaLabel);
  svg.classList.add("print-back-diagram-svg");

  let guideLayout: SleevelessGarmentDiagramLayout = piece === "front" ? "front" : "back";
  let diagramGuides = result.debug?.diagramGuides;
  if (piece === "front" && diagramGuides?.showBodyShapeGuides && cardiganHalfSide) {
    diagramGuides = scaleDiagramGuidesForCardiganHalf(diagramGuides, cardiganHalfSide);
    guideLayout = cardiganHalfSide === "right" ? "cardiganHalfRight" : "cardiganHalfLeft";
  }

  injectBodyShapeGuidesIntoGarmentSvg(svg as SVGSVGElement, diagramGuides, guideLayout);
  return svg.outerHTML;
}
