/**
 * Shared "Visual Guides" block for pattern sections — Shaping Notation (+ optional Shaping Map).
 * Presentation only; does not generate notation, maps, or shaping math.
 */
import { buildShapingNotationChartHelpTriggerHtml } from "../glossary/shapingNotationGlossary.ts";
import type { NotationPreviewConstruction } from "./neckShoulderShapingChartHtml.ts";
import { renderShapingMapSvg, type ShapingMapData } from "./shapingMapSvg.ts";

export type PatternVisualGuidesPiece = "front" | "back" | "sleeve";

export type BuildPatternVisualGuidesOpts = {
  /** Garment piece this block belongs to (drives preview assets and hydration hooks). */
  piece: PatternVisualGuidesPiece;
  /** When false, the Shaping Notation card is omitted. */
  notationSupported?: boolean;
  construction?: NotationPreviewConstruction;
  patternData?: unknown;
  /** Real shaping schedule only — omitted when null/undefined (no placeholder card). */
  shapingMapData?: ShapingMapData | null;
  /** Passed to `renderShapingMapSvg` (default true — first-shoulder front map is mirrored). */
  shapingMapMirror?: boolean;
};

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

function shapingNotationCardHtml(opts: BuildPatternVisualGuidesOpts): string {
  const notationSupported = opts.notationSupported === true;
  if (!notationSupported) return "";

  const piece = opts.piece;
  const helpTrigger = buildShapingNotationChartHelpTriggerHtml(escapeAttr, escapeHtml);

  return `<section class="ns-visual-guides__card ns-visual-guides__card--notation">
    <h4 class="ns-visual-guides__card-title">Shaping Notation</h4>
    ${helpTrigger}
    <div class="ns-visual-guides__preview ns-visual-guides__preview--notation" data-pattern-notation-host data-pattern-notation-piece="${escapeHtml(piece)}">
      <p class="sleeveless-pattern-boot-msg">Loading notation…</p>
    </div>
    <div class="ns-visual-guides__actions no-print">
      <button type="button" class="ns-visual-guides__enlarge" data-pattern-notation-enlarge aria-label="Enlarge shaping notation"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i> Enlarge</button>
    </div>
  </section>`;
}

function shapingMapCardHtml(
  shapingMapData: ShapingMapData,
  mirror: boolean,
): string {
  return `<section class="ns-visual-guides__card ns-visual-guides__card--map">
    <h4 class="ns-visual-guides__card-title">Shaping Map</h4>
    <div class="ns-visual-guides__preview ns-visual-guides__preview--map">${renderShapingMapSvg(shapingMapData, { mirror })}</div>
    <div class="ns-visual-guides__actions no-print">
      <button type="button" class="ns-visual-guides__enlarge" data-shaping-map-enlarge aria-label="Enlarge shaping map"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i> Enlarge</button>
    </div>
  </section>`;
}

/**
 * Renders the Visual Guides section (heading + one or two cards). Returns an empty string when
 * neither shaping notation nor a shaping map should be shown.
 */
export function buildPatternVisualGuidesHtml(opts: BuildPatternVisualGuidesOpts): string {
  const notationCard = shapingNotationCardHtml(opts);
  const shapingMapData = opts.shapingMapData ?? null;
  const mapCard = shapingMapData
    ? shapingMapCardHtml(shapingMapData, opts.shapingMapMirror !== false)
    : "";
  if (!notationCard && !mapCard) return "";

  const piece = opts.piece;
  const headingId = `ns-visual-guides-heading-${piece}`;
  const cardCount = (notationCard ? 1 : 0) + (mapCard ? 1 : 0);
  const gridModifier = cardCount <= 1 ? " ns-visual-guides__grid--single" : "";

  return `<section class="ns-visual-guides" aria-labelledby="${headingId}">
  <h3 class="ns-visual-guides__heading" id="${headingId}">Visual Guides</h3>
  <div class="ns-visual-guides__grid${gridModifier}">${notationCard}${mapCard}</div>
</section>`;
}
