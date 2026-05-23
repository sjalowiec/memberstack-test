import {
  applySleevelessDiagramBodyShapeSuffix,
  resolveSleevelessDiagramBodyShapeKind,
} from "./sleevelessDiagramBodyShapeSrc";

/** Pullover round-neck back measurement schematic (Stitches & Rows mode, straight body). */
export const SLEEVELESS_BACK_DIAGRAM_STS_ROWS_SRC =
  "/images/patterns/sleeveless/diagrams/diagram-back.svg";

/** A-line back measurement schematic (Stitches & Rows mode). */
export const SLEEVELESS_BACK_ALINE_DIAGRAM_STS_ROWS_SRC =
  "/images/patterns/sleeveless/diagrams/diagram-back-aline.svg";

/** Shaped-waist back measurement schematic (Stitches & Rows mode). */
export const SLEEVELESS_BACK_SHAPED_DIAGRAM_STS_ROWS_SRC =
  "/images/patterns/sleeveless/diagrams/diagram-back-shaped.svg";

/** Alias used by the pattern tab back diagram toggle (measurement mode). */
export const BACK_DIAGRAM_STS_ROWS_SRC = SLEEVELESS_BACK_DIAGRAM_STS_ROWS_SRC;

/** Pullover round-neck back Japanese notation schematic (Shaping Notation mode, straight body). */
export const SLEEVELESS_BACK_JP_NOTATION_DIAGRAM_SRC =
  "/images/patterns/sleeveless/diagrams/diagram-jp-back.svg";

/** A-line back Japanese notation schematic (Shaping Notation mode). */
export const SLEEVELESS_BACK_ALINE_JP_NOTATION_DIAGRAM_SRC =
  "/images/patterns/sleeveless/diagrams/diagram-jp-back-aline.svg";

/** Shaped-waist back Japanese notation schematic (Shaping Notation mode). */
export const SLEEVELESS_BACK_SHAPED_JP_NOTATION_DIAGRAM_SRC =
  "/images/patterns/sleeveless/diagrams/diagram-jp-back-shaped.svg";

/** Alias used by Japanese notation fetch/replace (shaping notation mode). */
export const JP_BACK_NOTATION_SVG_SRC = SLEEVELESS_BACK_JP_NOTATION_DIAGRAM_SRC;

export type SleevelessBackDiagramViewMode = "sts-rows" | "shaping-notation";

/**
 * Back piece with A-line body shaping — uses dedicated schematic SVGs when
 * {@link resolveSleevelessDiagramBodyShapeKind} resolves to `aline`.
 */
export function isSleevelessAlineBackDiagram(patternData: unknown): boolean {
  return resolveSleevelessDiagramBodyShapeKind(patternData) === "aline";
}

/** Canonical back garment diagram URL for the pattern-tab mode toggle. */
export function resolveSleevelessBackDiagramSrc(
  mode: SleevelessBackDiagramViewMode,
  patternData?: unknown,
): string {
  const straightBase =
    mode === "shaping-notation"
      ? SLEEVELESS_BACK_JP_NOTATION_DIAGRAM_SRC
      : SLEEVELESS_BACK_DIAGRAM_STS_ROWS_SRC;
  if (patternData === undefined) return straightBase;
  const kind = resolveSleevelessDiagramBodyShapeKind(patternData);
  return applySleevelessDiagramBodyShapeSuffix(straightBase, kind);
}
