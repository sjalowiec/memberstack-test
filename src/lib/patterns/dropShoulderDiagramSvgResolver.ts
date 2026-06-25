/**
 * Drop-shoulder garment diagram SVG inventory and selection.
 *
 * Maps only assets that exist on disk. Missing combinations fall back to the nearest
 * straight-body (or shared) asset with explicit {@link DropShoulderDiagramResolveResult.fallback}
 * metadata — A-line patterns must not silently use straight artwork without reporting it.
 */

import type { DropShoulderSleeveDirection } from "./dropShoulderSleeveConstruction";
import { resolveSleevelessDiagramBodyShapeKind } from "./sleevelessDiagramBodyShapeSrc";
import { isSleevelessCardiganGarmentStyle, isSleevelessVNeckChoice } from "./sleevelessFrontDiagramSrc";

const DROP_SHOULDER_DIAGRAM_ROOT = "/images/patterns/drop-shoulder";

export type DropShoulderDiagramPiece = "back" | "front" | "sleeve" | "summary";
export type DropShoulderDiagramMode = "sts-rows" | "japanese";
export type DropShoulderGarment = "pullover" | "cardigan";
export type DropShoulderNeckline = "round" | "v";
export type DropShoulderBodyShape = "straight" | "aline";

/** Pattern-tab toggle label — maps to {@link DropShoulderDiagramMode}. */
export type DropShoulderBodyDiagramViewMode = "sts-rows" | "shaping-notation";

export interface DropShoulderDiagramCriteria {
  piece: DropShoulderDiagramPiece;
  mode: DropShoulderDiagramMode;
  /** Required for `front`; ignored for back / sleeve / summary. */
  garment?: DropShoulderGarment;
  /** Front only; defaults to `round`. */
  neckline?: DropShoulderNeckline;
  /** Defaults to `straight`. */
  bodyShape?: DropShoulderBodyShape;
  /** Sleeve piece only. */
  sleeveDirection?: DropShoulderSleeveDirection;
}

export interface DropShoulderDiagramAsset {
  src: string;
  piece: DropShoulderDiagramPiece;
  mode: DropShoulderDiagramMode;
  bodyShape: DropShoulderBodyShape;
  garment?: DropShoulderGarment;
  /** When set, the artwork is neck-style-specific (no straight-body shared asset). */
  necklineArtwork?: DropShoulderNeckline;
  sleeveDirection?: DropShoulderSleeveDirection;
  notes?: string;
}

export interface DropShoulderDiagramFallback {
  reason: string;
  requested: DropShoulderDiagramCriteria;
  fallbackSrc: string;
  fallbackBodyShape: DropShoulderBodyShape;
}

export interface DropShoulderDiagramResolveResult {
  src: string;
  exactMatch: boolean;
  matchedAsset?: DropShoulderDiagramAsset;
  fallback?: DropShoulderDiagramFallback;
  /** Ideal path when no dedicated asset exists (for audits / Illustrator backlog). */
  expectedAssetPath?: string;
}

export interface DropShoulderDiagramGridCell extends DropShoulderDiagramResolveResult {
  criteria: DropShoulderDiagramCriteria;
}

/**
 * Verified on-disk drop-shoulder diagram SVGs (excluding hero WebP, decorative sleeve pickers,
 * and quick-reference preview crops).
 */
export const DROP_SHOULDER_DIAGRAM_ASSETS: readonly DropShoulderDiagramAsset[] = [
  {
    src: `${DROP_SHOULDER_DIAGRAM_ROOT}/drop-body-back.svg`,
    piece: "back",
    mode: "sts-rows",
    bodyShape: "straight",
    notes: "Shared back measurement schematic (pullover and cardigan).",
  },
  {
    src: `${DROP_SHOULDER_DIAGRAM_ROOT}/jp-drop-body-back.svg`,
    piece: "back",
    mode: "japanese",
    bodyShape: "straight",
    notes: "Shared back Japanese notation (pullover and cardigan).",
  },
  {
    src: `${DROP_SHOULDER_DIAGRAM_ROOT}/drop-body-back-aline.svg`,
    piece: "back",
    mode: "sts-rows",
    bodyShape: "aline",
    notes: "Shared A-line back measurement schematic (pullover and cardigan).",
  },
  {
    src: `${DROP_SHOULDER_DIAGRAM_ROOT}/diagram-jp-back-aline.svg`,
    piece: "back",
    mode: "japanese",
    bodyShape: "aline",
    notes: "Shared A-line back Japanese notation (pullover and cardigan).",
  },
  {
    src: `${DROP_SHOULDER_DIAGRAM_ROOT}/drop-body-front.svg`,
    piece: "front",
    mode: "sts-rows",
    garment: "pullover",
    bodyShape: "straight",
    notes: "Pullover front measurement; round and V-neck share this straight-body asset.",
  },
  {
    src: `${DROP_SHOULDER_DIAGRAM_ROOT}/jp-drop-body-front.svg`,
    piece: "front",
    mode: "japanese",
    garment: "pullover",
    bodyShape: "straight",
    notes: "Pullover front Japanese notation; round and V-neck share this straight-body asset.",
  },
  {
    src: `${DROP_SHOULDER_DIAGRAM_ROOT}/diagram-front-v-aline.svg`,
    piece: "front",
    mode: "sts-rows",
    garment: "pullover",
    bodyShape: "aline",
    necklineArtwork: "v",
    notes: "A-line pullover front measurement with V-neck artwork.",
  },
  {
    src: `${DROP_SHOULDER_DIAGRAM_ROOT}/diagram-jp-front-v-aline.svg`,
    piece: "front",
    mode: "japanese",
    garment: "pullover",
    bodyShape: "aline",
    necklineArtwork: "v",
    notes: "A-line pullover front Japanese notation with V-neck artwork.",
  },
  {
    src: `${DROP_SHOULDER_DIAGRAM_ROOT}/body/drop_body_cardigan.svg`,
    piece: "front",
    mode: "sts-rows",
    garment: "cardigan",
    bodyShape: "straight",
    notes: "Cardigan front measurement; round and V-neck share this straight-body asset.",
  },
  {
    src: `${DROP_SHOULDER_DIAGRAM_ROOT}/japanese/jp-drop-body-cardigan.svg`,
    piece: "front",
    mode: "japanese",
    garment: "cardigan",
    bodyShape: "straight",
    notes: "Cardigan front Japanese notation; round and V-neck share this straight-body asset.",
  },
  {
    src: `${DROP_SHOULDER_DIAGRAM_ROOT}/drop-A-body-cardigan.svg`,
    piece: "front",
    mode: "sts-rows",
    garment: "cardigan",
    bodyShape: "aline",
    necklineArtwork: "round",
    notes: "A-line cardigan front measurement with round-neck artwork (draft A prefix).",
  },
  {
    src: `${DROP_SHOULDER_DIAGRAM_ROOT}/drop-body-sleeve.svg`,
    piece: "sleeve",
    mode: "sts-rows",
    bodyShape: "straight",
    sleeveDirection: "cuff-up",
  },
  {
    src: `${DROP_SHOULDER_DIAGRAM_ROOT}/drop-body-sleeve-top-down.svg`,
    piece: "sleeve",
    mode: "sts-rows",
    bodyShape: "straight",
    sleeveDirection: "top-down",
  },
  {
    src: `${DROP_SHOULDER_DIAGRAM_ROOT}/JP-drop-body-sleeve.svg`,
    piece: "sleeve",
    mode: "japanese",
    bodyShape: "straight",
    sleeveDirection: "cuff-up",
  },
  {
    src: `${DROP_SHOULDER_DIAGRAM_ROOT}/jp-drop-body-sleeve-top-down.svg`,
    piece: "sleeve",
    mode: "japanese",
    bodyShape: "straight",
    sleeveDirection: "top-down",
  },
  {
    src: `${DROP_SHOULDER_DIAGRAM_ROOT}/drop_shoulder_summary.svg`,
    piece: "summary",
    mode: "sts-rows",
    bodyShape: "straight",
    notes: "Builder/review measurement blueprint (includes sleeve targets).",
  },
] as const;

export function dropShoulderBodyDiagramViewModeToDiagramMode(
  mode: DropShoulderBodyDiagramViewMode,
): DropShoulderDiagramMode {
  return mode === "shaping-notation" ? "japanese" : "sts-rows";
}

export function normalizeDropShoulderDiagramCriteria(
  raw: DropShoulderDiagramCriteria,
): DropShoulderDiagramCriteria {
  const bodyShape = raw.bodyShape ?? "straight";
  const neckline = raw.neckline ?? "round";
  return {
    ...raw,
    bodyShape,
    neckline: raw.piece === "front" ? neckline : undefined,
    garment: raw.piece === "front" ? raw.garment ?? "pullover" : undefined,
    sleeveDirection:
      raw.piece === "sleeve" ? raw.sleeveDirection ?? "cuff-up" : undefined,
  };
}

/** Maps pattern `shaped` body to `aline` for drop-shoulder diagram routing. */
export function dropShoulderDiagramBodyShapeFromPattern(patternData: unknown): DropShoulderBodyShape {
  const kind = resolveSleevelessDiagramBodyShapeKind(patternData);
  return kind === "straight" ? "straight" : "aline";
}

export function dropShoulderNecklineFromPattern(patternData: unknown): DropShoulderNeckline {
  return isSleevelessVNeckChoice(patternData) ? "v" : "round";
}

export function dropShoulderGarmentFromPattern(patternData: unknown): DropShoulderGarment {
  return isSleevelessCardiganGarmentStyle(patternData) ? "cardigan" : "pullover";
}

/**
 * Ideal filename for a criteria combo (audit / backlog only — file may not exist).
 * Follows production `drop-body-*` / `jp-drop-body-*` names, draft `drop-A-body-*`, and
 * sleeveless `-aline` suffix parity where no draft file exists yet.
 */
export function expectedDropShoulderDiagramAssetPath(
  raw: DropShoulderDiagramCriteria,
): string {
  const c = normalizeDropShoulderDiagramCriteria(raw);

  if (c.piece === "summary") {
    return `${DROP_SHOULDER_DIAGRAM_ROOT}/drop_shoulder_summary.svg`;
  }

  if (c.piece === "sleeve") {
    const direction = c.sleeveDirection ?? "cuff-up";
    if (c.mode === "japanese") {
      return direction === "top-down"
        ? `${DROP_SHOULDER_DIAGRAM_ROOT}/jp-drop-body-sleeve-top-down.svg`
        : `${DROP_SHOULDER_DIAGRAM_ROOT}/JP-drop-body-sleeve.svg`;
    }
    return direction === "top-down"
      ? `${DROP_SHOULDER_DIAGRAM_ROOT}/drop-body-sleeve-top-down.svg`
      : `${DROP_SHOULDER_DIAGRAM_ROOT}/drop-body-sleeve.svg`;
  }

  const aline = c.bodyShape === "aline";
  const vSuffix = c.neckline === "v" ? "-v" : "";

  if (c.piece === "back") {
    if (aline) {
      if (c.mode === "japanese") {
        return `${DROP_SHOULDER_DIAGRAM_ROOT}/diagram-jp-back-aline.svg`;
      }
      return `${DROP_SHOULDER_DIAGRAM_ROOT}/drop-body-back-aline.svg`;
    }
    return c.mode === "japanese"
      ? `${DROP_SHOULDER_DIAGRAM_ROOT}/jp-drop-body-back.svg`
      : `${DROP_SHOULDER_DIAGRAM_ROOT}/drop-body-back.svg`;
  }

  // front
  if (c.garment === "cardigan") {
    if (aline) {
      if (c.mode === "japanese") {
        return `${DROP_SHOULDER_DIAGRAM_ROOT}/japanese/jp-drop-body-cardigan${vSuffix}-aline.svg`;
      }
      return `${DROP_SHOULDER_DIAGRAM_ROOT}/drop-A-body-cardigan${vSuffix}.svg`;
    }
    return c.mode === "japanese"
      ? `${DROP_SHOULDER_DIAGRAM_ROOT}/japanese/jp-drop-body-cardigan.svg`
      : `${DROP_SHOULDER_DIAGRAM_ROOT}/body/drop_body_cardigan.svg`;
  }

  // pullover front
  if (aline) {
    if (c.mode === "japanese") {
      return c.neckline === "v"
        ? `${DROP_SHOULDER_DIAGRAM_ROOT}/diagram-jp-front-v-aline.svg`
        : `${DROP_SHOULDER_DIAGRAM_ROOT}/jp-drop-body-front-aline.svg`;
    }
    return c.neckline === "v"
      ? `${DROP_SHOULDER_DIAGRAM_ROOT}/diagram-front-v-aline.svg`
      : `${DROP_SHOULDER_DIAGRAM_ROOT}/drop-A-body-front.svg`;
  }
  return c.mode === "japanese"
    ? `${DROP_SHOULDER_DIAGRAM_ROOT}/jp-drop-body-front.svg`
    : `${DROP_SHOULDER_DIAGRAM_ROOT}/drop-body-front.svg`;
}

function assetMatchesCriteria(
  asset: DropShoulderDiagramAsset,
  criteria: DropShoulderDiagramCriteria,
): boolean {
  if (asset.piece !== criteria.piece) return false;
  if (asset.mode !== criteria.mode) return false;
  if (asset.bodyShape !== criteria.bodyShape) return false;

  if (criteria.piece === "front") {
    if (asset.garment !== criteria.garment) return false;
    if (asset.necklineArtwork && asset.necklineArtwork !== criteria.neckline) return false;
  }

  if (criteria.piece === "sleeve" && asset.sleeveDirection !== criteria.sleeveDirection) {
    return false;
  }

  return true;
}

function findRegistryAsset(
  criteria: DropShoulderDiagramCriteria,
): DropShoulderDiagramAsset | undefined {
  return DROP_SHOULDER_DIAGRAM_ASSETS.find((asset) => assetMatchesCriteria(asset, criteria));
}

function straightFallbackCriteria(
  criteria: DropShoulderDiagramCriteria,
): DropShoulderDiagramCriteria {
  return { ...criteria, bodyShape: "straight", neckline: criteria.neckline };
}

function buildFallbackResult(
  criteria: DropShoulderDiagramCriteria,
  fallbackAsset: DropShoulderDiagramAsset,
  reason: string,
): DropShoulderDiagramFallback {
  return {
    reason,
    requested: criteria,
    fallbackSrc: fallbackAsset.src,
    fallbackBodyShape: fallbackAsset.bodyShape,
  };
}

export function resolveDropShoulderDiagramSvg(
  raw: DropShoulderDiagramCriteria,
): DropShoulderDiagramResolveResult {
  const criteria = normalizeDropShoulderDiagramCriteria(raw);
  const expectedAssetPath = expectedDropShoulderDiagramAssetPath(criteria);

  const exact = findRegistryAsset(criteria);
  if (exact) {
    return {
      src: exact.src,
      exactMatch: true,
      matchedAsset: exact,
      expectedAssetPath,
    };
  }

  // A-line front: allow neckline-mismatched draft art before straight fallback (still reported).
  if (criteria.piece === "front" && criteria.bodyShape === "aline") {
    const alineLoose = DROP_SHOULDER_DIAGRAM_ASSETS.find(
      (asset) =>
        asset.piece === "front" &&
        asset.mode === criteria.mode &&
        asset.garment === criteria.garment &&
        asset.bodyShape === "aline",
    );
    if (alineLoose && alineLoose.necklineArtwork !== criteria.neckline) {
      return {
        src: alineLoose.src,
        exactMatch: false,
        matchedAsset: alineLoose,
        expectedAssetPath,
        fallback: buildFallbackResult(
          criteria,
          alineLoose,
          `A-line ${criteria.garment} front ${criteria.mode} asset exists for ${alineLoose.necklineArtwork ?? "unknown"} neckline artwork only; requested ${criteria.neckline} neckline.`,
        ),
      };
    }
  }

  const straightCriteria = straightFallbackCriteria(criteria);
  const straight = findRegistryAsset(straightCriteria);
  if (straight) {
    const reason =
      criteria.bodyShape === "aline"
        ? `No A-line ${criteria.piece} ${criteria.mode} diagram; using straight-body ${straight.src}.`
        : `No exact match; using straight-body ${straight.src}.`;

    return {
      src: straight.src,
      exactMatch: false,
      matchedAsset: straight,
      expectedAssetPath,
      fallback: buildFallbackResult(criteria, straight, reason),
    };
  }

  throw new Error(
    `No drop-shoulder diagram asset or fallback for ${JSON.stringify(criteria)} (expected ${expectedAssetPath}).`,
  );
}

export function resolveDropShoulderDiagramSvgFromPattern(
  piece: DropShoulderDiagramPiece,
  mode: DropShoulderDiagramMode | DropShoulderBodyDiagramViewMode,
  patternData?: unknown,
  options?: { sleeveDirection?: DropShoulderSleeveDirection },
): DropShoulderDiagramResolveResult {
  const diagramMode =
    mode === "sts-rows" || mode === "japanese"
      ? mode
      : dropShoulderBodyDiagramViewModeToDiagramMode(mode);

  const criteria: DropShoulderDiagramCriteria = {
    piece,
    mode: diagramMode,
    bodyShape: patternData ? dropShoulderDiagramBodyShapeFromPattern(patternData) : "straight",
  };

  if (piece === "front") {
    criteria.garment = dropShoulderGarmentFromPattern(patternData);
    criteria.neckline = dropShoulderNecklineFromPattern(patternData);
  }

  if (piece === "sleeve") {
    criteria.sleeveDirection = options?.sleeveDirection ?? "cuff-up";
  }

  return resolveDropShoulderDiagramSvg(criteria);
}

/** Full cross-product audit for body pieces (and sleeve/summary baselines). */
export function auditDropShoulderDiagramAssetGrid(): DropShoulderDiagramGridCell[] {
  const modes: DropShoulderDiagramMode[] = ["sts-rows", "japanese"];
  const bodyShapes: DropShoulderBodyShape[] = ["straight", "aline"];
  const garments: DropShoulderGarment[] = ["pullover", "cardigan"];
  const necklines: DropShoulderNeckline[] = ["round", "v"];
  const cells: DropShoulderDiagramGridCell[] = [];

  for (const bodyShape of bodyShapes) {
    for (const mode of modes) {
      const backCriteria: DropShoulderDiagramCriteria = { piece: "back", mode, bodyShape };
      cells.push({
        criteria: backCriteria,
        ...resolveDropShoulderDiagramSvg(backCriteria),
      });
    }
  }

  for (const garment of garments) {
    for (const neckline of necklines) {
      for (const bodyShape of bodyShapes) {
        for (const mode of modes) {
          const frontCriteria: DropShoulderDiagramCriteria = {
            piece: "front",
            mode,
            garment,
            neckline,
            bodyShape,
          };
          cells.push({
            criteria: frontCriteria,
            ...resolveDropShoulderDiagramSvg(frontCriteria),
          });
        }
      }
    }
  }

  for (const mode of modes) {
    for (const sleeveDirection of ["cuff-up", "top-down"] as const) {
      const sleeveCriteria: DropShoulderDiagramCriteria = {
        piece: "sleeve",
        mode,
        bodyShape: "straight",
        sleeveDirection,
      };
      cells.push({
        criteria: sleeveCriteria,
        ...resolveDropShoulderDiagramSvg(sleeveCriteria),
      });
    }
  }

  cells.push({
    criteria: { piece: "summary", mode: "sts-rows", bodyShape: "straight" },
    ...resolveDropShoulderDiagramSvg({ piece: "summary", mode: "sts-rows", bodyShape: "straight" }),
  });

  return cells;
}

/** Logs when a non-exact diagram asset was chosen (dev visibility for missing A-line art). */
export function reportDropShoulderDiagramFallback(
  result: DropShoulderDiagramResolveResult,
  context?: string,
): void {
  if (result.exactMatch || !result.fallback) return;
  console.warn(
    `[drop-shoulder] Diagram asset fallback${context ? `: ${context}` : ""} — ${result.fallback.reason}`,
    {
      requested: result.fallback.requested,
      resolved: result.src,
      expected: result.expectedAssetPath,
    },
  );
}

export function formatDropShoulderDiagramGridReport(cells: DropShoulderDiagramGridCell[]): string {
  const lines: string[] = ["Drop Shoulder diagram asset grid", ""];
  for (const cell of cells) {
    const c = cell.criteria;
    const key = [
      c.piece,
      c.mode,
      c.garment ?? "—",
      c.neckline ?? "—",
      c.bodyShape,
      c.sleeveDirection ?? "",
    ]
      .filter(Boolean)
      .join(" | ");
    const status = cell.exactMatch ? "EXACT" : "FALLBACK";
    lines.push(`${status}\t${key}`);
    lines.push(`  resolved: ${cell.src}`);
    if (cell.expectedAssetPath && cell.expectedAssetPath !== cell.src) {
      lines.push(`  expected: ${cell.expectedAssetPath}`);
    }
    if (cell.fallback) {
      lines.push(`  reason: ${cell.fallback.reason}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
