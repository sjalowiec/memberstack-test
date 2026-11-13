/**
 * Finished Triangle Scarf page: section jumps and the yarn drawer payload.
 * Instructions themselves come from buildTriangleScarfPatternHtml.
 */

import type { PatternInpageNavItem } from "../patternInpageNav";
import type { YarnDimensionsDetail } from "../../tools/yarnRequirementDimensions";
import {
  triangleScarfYarnAreaSquareInches,
  triangleScarfYarnHeading,
  type TriangleScarfOk,
} from "../triangleScarfMath";

export const TRIANGLE_SCARF_TIPS_STORAGE_KEY = "triangle-scarf-show-tips";

export const TRIANGLE_SCARF_PATTERN_INPAGE_NAV_ITEMS: readonly PatternInpageNavItem[] = [
  { label: "Scarf", ids: ["construction"] },
  { label: "Increase", ids: ["increase"] },
  { label: "Decrease", ids: ["decrease"] },
  { label: "Bind off", ids: ["bind-off"] },
  { label: "I-cord", ids: ["optional-edge"] },
];

export function buildTriangleScarfYarnDimensionsDetail(result: TriangleScarfOk): YarnDimensionsDetail {
  return {
    projectWidth: result.requestedLength,
    projectLength: result.requestedDepth,
    lengthUnit: result.unit,
    source: "custom",
    projectAreaSquareInches: triangleScarfYarnAreaSquareInches(
      result.requestedLength,
      result.requestedDepth,
      result.unit,
    ),
  };
}

export function triangleScarfYarnHeadingForResult(result: TriangleScarfOk): string {
  return triangleScarfYarnHeading(result.requestedLength, result.requestedDepth, result.unit);
}
