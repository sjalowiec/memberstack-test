/** Pullover round-neck back measurement schematic (Stitches & Rows mode). */
export const SLEEVELESS_BACK_DIAGRAM_STS_ROWS_SRC =
  "/images/patterns/sleeveless/diagrams/diagram-back.svg";

/** Alias used by the pattern tab back diagram toggle (measurement mode). */
export const BACK_DIAGRAM_STS_ROWS_SRC = SLEEVELESS_BACK_DIAGRAM_STS_ROWS_SRC;

/** Pullover round-neck back Japanese notation schematic (Shaping Notation mode). */
export const SLEEVELESS_BACK_JP_NOTATION_DIAGRAM_SRC =
  "/images/patterns/sleeveless/diagrams/diagram-jp-back.svg";

/** Alias used by Japanese notation fetch/replace (shaping notation mode). */
export const JP_BACK_NOTATION_SVG_SRC = SLEEVELESS_BACK_JP_NOTATION_DIAGRAM_SRC;

export type SleevelessBackDiagramViewMode = "sts-rows" | "shaping-notation";

/** Canonical back garment diagram URL for the pattern-tab mode toggle. */
export function resolveSleevelessBackDiagramSrc(mode: SleevelessBackDiagramViewMode): string {
  return mode === "shaping-notation"
    ? SLEEVELESS_BACK_JP_NOTATION_DIAGRAM_SRC
    : SLEEVELESS_BACK_DIAGRAM_STS_ROWS_SRC;
}
