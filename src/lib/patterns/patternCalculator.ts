export function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function calculateBasicPatternNumbers(patternData: any) {
  const fit = patternData?.fit || {};
  const yarnGaugeMachine = patternData?.yarnGaugeMachine || {};

  const stitchesPerInch = toNumber(yarnGaugeMachine.gaugeStitchesPerInch);
  const rowsPerInch = toNumber(yarnGaugeMachine.gaugeRowsPerInch);
  const availableNeedles = toNumber(yarnGaugeMachine.availableNeedles);

  const finishedBustChest = toNumber(
    fit?.selectedMeasurements?.finished_bust_chest
  );

  const bustChestStitches = Math.round(finishedBustChest * stitchesPerInch);

  const shoulderWidth = toNumber(fit?.selectedMeasurements?.shoulder_width);
  const stitchesAfterArmhole =
    shoulderWidth > 0 && stitchesPerInch > 0
      ? Math.round(shoulderWidth * stitchesPerInch)
      : undefined;

  return {
    stitchesPerInch,
    rowsPerInch,
    availableNeedles,
    finishedBustChest,
    bustChestStitches,
    stitchesAfterArmhole,
    fitsOnMachine:
      availableNeedles > 0 && bustChestStitches <= availableNeedles
  };
}
