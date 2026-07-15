/**
 * Shared "Visual Guides" block for pattern sections — Japanese Notation (+ optional Shaping Map).
 * Presentation only; does not generate notation, maps, or shaping math.
 */
import {
  resolveJapaneseNotationQuickReferencePreviewSrc,
  type NotationPreviewConstruction,
  type NotationPreviewPiece,
} from "./neckShoulderShapingChartHtml.ts";
import { renderShapingMapSvg, type ShapingMapData } from "./shapingMapSvg.ts";

export type PatternVisualGuidesPiece = NotationPreviewPiece | "sleeve";

export type BuildPatternVisualGuidesOpts = {
  /** Garment piece this block belongs to (drives preview assets and hydration hooks). */
  piece: PatternVisualGuidesPiece;
  /** When false, the Japanese Notation card is omitted. */
  notationSupported?: boolean;
  /**
   * When true, the card hosts an inline SVG (hydrated post-mount via `data-pattern-notation-host`).
   * When false, a static quick-reference crop opens the piece diagram's Shaping Notation modal.
   * Sleeves always use inline mode (no static preview asset).
   */
  notationInline?: boolean;
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

function japaneseNotationCardHtml(opts: BuildPatternVisualGuidesOpts): string {
  const notationSupported = opts.notationSupported === true;
  if (!notationSupported) return "";

  const piece = opts.piece;
  const construction = opts.construction ?? "sleeveless";
  const patternData = opts.patternData;
  const useInline = piece === "sleeve" || opts.notationInline === true;
  const previewPiece = piece === "sleeve" ? "front" : piece;

  if (useInline) {
    return `<section class="ns-visual-guides__card ns-visual-guides__card--jp">
    <h4 class="ns-visual-guides__card-title">Japanese Notation</h4>
    <div class="ns-visual-guides__preview ns-visual-guides__preview--notation" data-pattern-notation-host data-pattern-notation-piece="${escapeHtml(piece)}">
      <p class="sleeveless-pattern-boot-msg">Loading notation…</p>
    </div>
    <div class="ns-visual-guides__actions no-print">
      <button type="button" class="ns-visual-guides__enlarge" data-pattern-notation-enlarge aria-label="Enlarge Japanese notation"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i> Enlarge</button>
    </div>
  </section>`;
  }

  const previewSrc = resolveJapaneseNotationQuickReferencePreviewSrc(
    previewPiece,
    construction,
    patternData,
  );
  return `<section class="ns-visual-guides__card ns-visual-guides__card--jp">
    <h4 class="ns-visual-guides__card-title">Japanese Notation</h4>
    <button type="button" class="ns-visual-guides__preview" data-neckline-notation-preview-trigger="${escapeHtml(previewPiece)}" aria-label="Enlarge Japanese notation quick reference">
      <img class="ns-visual-guides__preview-img" src="${escapeHtml(previewSrc)}" alt="" loading="lazy" aria-hidden="true" />
      <span class="ns-visual-guides__zoom" aria-hidden="true"><i class="fa-solid fa-magnifying-glass"></i></span>
    </button>
    <div class="ns-visual-guides__actions no-print">
      <button type="button" class="ns-visual-guides__enlarge" data-neckline-notation-preview-trigger="${escapeHtml(previewPiece)}"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i> Enlarge</button>
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
 * neither Japanese notation nor a shaping map should be shown.
 */
export function buildPatternVisualGuidesHtml(opts: BuildPatternVisualGuidesOpts): string {
  const jpCard = japaneseNotationCardHtml(opts);
  const shapingMapData = opts.shapingMapData ?? null;
  const mapCard = shapingMapData
    ? shapingMapCardHtml(shapingMapData, opts.shapingMapMirror !== false)
    : "";
  if (!jpCard && !mapCard) return "";

  const piece = opts.piece;
  const headingId = `ns-visual-guides-heading-${piece}`;
  const cardCount = (jpCard ? 1 : 0) + (mapCard ? 1 : 0);
  const gridModifier = cardCount <= 1 ? " ns-visual-guides__grid--single" : "";

  return `<section class="ns-visual-guides" aria-labelledby="${headingId}">
  <h3 class="ns-visual-guides__heading" id="${headingId}">Visual Guides</h3>
  <div class="ns-visual-guides__grid${gridModifier}">${jpCard}${mapCard}</div>
</section>`;
}
