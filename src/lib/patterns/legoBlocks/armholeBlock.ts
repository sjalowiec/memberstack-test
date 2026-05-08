export type { ArmholeInput, ArmholeResult } from "./armholeShaping";
export { calculateArmholeShaping } from "./armholeShaping";

import type { ArmholeResult } from "./armholeShaping";

export function buildArmholeInstructions(result: ArmholeResult): string[] {
  return [
    `Bind off ${result.bindOffSts} stitches at beginning of next 2 rows.`,
    `Decrease 1 stitch at each armhole edge every other row ${result.decreaseSts} times.`,
    `Work even for ${result.evenRows} rows.`,
  ];
}
