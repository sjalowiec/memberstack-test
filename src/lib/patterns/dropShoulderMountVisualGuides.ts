/**
 * Drop Shoulder Visual Guides map resolution for the pattern mount.
 *
 * Important: gate V-neck with the same {@link generatorPatternData} object passed to
 * {@link generateDropShoulderPattern}. Do NOT use `buildSleevelessGarmentDiagramPatternData`,
 * which can re-resolve neckline from wizard/express storage and incorrectly suppress the back map
 * while the front map (gated on gen `style.neckline`) still renders.
 */

import { buildPatternVisualGuidesHtml } from "./patternVisualGuides";
import { buildSleevelessRoundNeckBackShapingMapData } from "./sleevelessRoundNeckBackShapingSchedule";
import { buildSleevelessRoundNeckShapingMapData } from "./sleevelessRoundNeckShapingSchedule";
import type { ShapingMapData } from "./shapingMapSvg";
import type { RowEntry } from "./shapingTimeline";

export type DropShoulderMountShapingMapResult = {
  backShapingMapData: ShapingMapData | null;
  frontShapingMapData: ShapingMapData | null;
};

type DropShoulderMountPatternResult = {
  backNeckShoulderTimeline?: RowEntry[];
  frontNeckShoulderTimeline?: RowEntry[];
  frontNeckShoulderChartUsesLiveRows?: boolean;
  debug?: {
    armholeStartRow?: number;
    /** Garment RC where the back neckline counter resets to 000. */
    backNecklineStartRC?: number;
    /** Garment RC where the front neckline counter resets to 000. */
    frontNecklineStartRC?: number;
  };
};

function sectionStyle(patternData: unknown): Record<string, unknown> {
  const pd =
    patternData && typeof patternData === "object" && !Array.isArray(patternData)
      ? (patternData as Record<string, unknown>)
      : {};
  const st = pd.style;
  return st && typeof st === "object" && !Array.isArray(st) ? (st as Record<string, unknown>) : {};
}

/**
 * Resolve Drop Shoulder front/back shaping maps for Visual Guides using generator input
 * (the same object generation used), never the diagram-pattern rebuild.
 */
export function buildDropShoulderMountShapingMapData(
  result: DropShoulderMountPatternResult | null | undefined,
  generatorPatternData: unknown,
  options?: { isCardigan?: boolean },
): DropShoulderMountShapingMapResult {
  const isCardigan = options?.isCardigan === true;
  const neckline = String(sectionStyle(generatorPatternData).neckline || "");
  const isRoundNeckPullover = neckline !== "v-neck" && !isCardigan;

  // Front neckline map uses the post-reset neckline counter (origin = frontNecklineStartRC → RC:000).
  // Do NOT use armholeStartRow — that yields armhole-local RC (e.g. 12 = 129 − 117).
  const frontShapingMapData =
    isRoundNeckPullover && result?.frontNeckShoulderChartUsesLiveRows
      ? buildSleevelessRoundNeckShapingMapData(result.frontNeckShoulderTimeline, {
          firstArmholeRc: result.debug?.frontNecklineStartRC,
          title: "Front neckline shaping map",
        })
      : null;

  // Back neckline map uses the post-reset neckline counter (origin = backNecklineStartRC → RC:000).
  // Do NOT use armholeStartRow here — that yields armhole-local RC (e.g. 34) after the neckline reset.
  const backShapingMapData = buildSleevelessRoundNeckBackShapingMapData(
    result?.backNeckShoulderTimeline,
    {
      firstArmholeRc: result?.debug?.backNecklineStartRC,
      title: "Back neckline shaping map",
      patternData: generatorPatternData,
    },
  );

  return { backShapingMapData, frontShapingMapData };
}

/**
 * Build the Back Visual Guides HTML exactly as the Drop Shoulder mount embeds it.
 */
export function buildDropShoulderBackVisualGuidesHtml(
  result: DropShoulderMountPatternResult | null | undefined,
  generatorPatternData: unknown,
  options?: { isCardigan?: boolean; notationSupported?: boolean },
): string {
  const notationSupported = options?.notationSupported !== false;
  const { backShapingMapData } = buildDropShoulderMountShapingMapData(result, generatorPatternData, {
    isCardigan: options?.isCardigan === true,
  });
  return buildPatternVisualGuidesHtml({
    piece: "back",
    notationSupported,
    construction: "drop-shoulder",
    shapingMapData: backShapingMapData,
  });
}

/**
 * Assemble the Back piece HTML fragment the mount puts under the BACK section
 * (neckline full-width region containing Visual Guides).
 */
export function buildDropShoulderBackMountHtml(
  result: DropShoulderMountPatternResult & {
    displayRows?: ReadonlyArray<{ kind: string; title?: string }>;
  },
  generatorPatternData: unknown,
  options?: { isCardigan?: boolean; notationSupported?: boolean },
): string {
  const visualGuidesHtml = buildDropShoulderBackVisualGuidesHtml(result, generatorPatternData, options);
  const hasNeckShoulderSection = (result.displayRows ?? []).some(
    (row) =>
      row.kind === "section" && /NECKLINE\s*&\s*SHOULDERS/i.test(String(row.title || "")),
  );
  const necklineRegion = hasNeckShoulderSection
    ? `<div class="sleeveless-piece-neckline-fullwidth"><section class="pattern-subsection sleeveless-piece-chart-fullwidth">${visualGuidesHtml}</section></div>`
    : visualGuidesHtml;

  return `<section id="sg-back" class="pattern-section pattern-section--garment-piece" data-pattern-section="sg-back"><h2 class="pattern-section-title">BACK</h2>${necklineRegion}</section>`;
}
