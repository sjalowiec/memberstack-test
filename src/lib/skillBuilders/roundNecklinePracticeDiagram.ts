import type { RoundNecklinePracticeResult } from "./roundNecklinePractice";
import type { SkillBuilderDiagramValues } from "./skillBuilderDiagram";

/** Read SVG placeholders from the shared calculation result (no recalculation). */
export function buildRoundNecklinePracticeDiagramValues(
  result: RoundNecklinePracticeResult,
): SkillBuilderDiagramValues {
  return { ...result.svgPlaceholders };
}
