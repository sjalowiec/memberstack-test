/**
 * Christmas Stocking geometry.
 * Calls the Basic Socks calculator. Leg circumference is locked to foot circumference
 * so the leg is knit even. Dimensions are never stretched or clamped.
 */

import {
  calculateBasicSockPattern,
  type BasicSockCalc,
  type BasicSockCalcInput,
  type BasicSockCalcResult,
} from "../sock/sockMath";

export type ChristmasStockingDirection = "cuff-down" | "toe-up";

export type ChristmasStockingCalcInput = {
  direction: ChristmasStockingDirection;
  legLengthInches: number;
  footCircumferenceInches: number;
  footLengthInches: number;
  stitchGaugeDisplay: number;
  rowGaugeDisplay: number;
  displayUnit: "inches" | "cm";
};

export function stockingDirectionToSockDirection(
  direction: ChristmasStockingDirection,
): BasicSockCalcInput["constructionDirection"] {
  return direction === "cuff-down" ? "cuff-to-toe" : "toe-up";
}

export function sockDirectionToStockingDirection(
  direction: BasicSockCalcInput["constructionDirection"] | "",
): ChristmasStockingDirection | "" {
  if (direction === "cuff-to-toe") return "cuff-down";
  if (direction === "toe-up") return "toe-up";
  return "";
}

export function calculateChristmasStockingPattern(
  input: ChristmasStockingCalcInput,
): BasicSockCalcResult {
  return calculateBasicSockPattern({
    constructionDirection: stockingDirectionToSockDirection(input.direction),
    legLengthInches: input.legLengthInches,
    footLengthInches: input.footLengthInches,
    footCircumferenceInches: input.footCircumferenceInches,
    legCircumferenceInches: input.footCircumferenceInches,
    stitchGaugeDisplay: input.stitchGaugeDisplay,
    rowGaugeDisplay: input.rowGaugeDisplay,
    displayUnit: input.displayUnit,
  });
}

export type { BasicSockCalc as ChristmasStockingCalc };
