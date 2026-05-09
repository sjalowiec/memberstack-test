/**
 * Pure merge helpers for sleeveless pattern display + {@link generateSleevelessBackPattern} input.
 * Mirrors the former inline logic on the builder pattern tab / print route (localStorage-free).
 */

export function sectionPattern(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

export function mergedPatternForDisplayFromSources(
  base: Record<string, unknown>,
  patternBuilderData: Record<string, unknown>,
): Record<string, unknown> {
  const patternData = patternBuilderData;
  const st = { ...sectionPattern(base.style), ...sectionPattern(patternData.style) };
  const ft = { ...sectionPattern(base.fit), ...sectionPattern(patternData.fit) };
  let yarnGauge = { ...sectionPattern(base.yarnGauge) };
  let machine = { ...sectionPattern(base.machine) };
  const ygm = patternData.yarnGaugeMachine;
  if (ygm && typeof ygm === "object" && !Array.isArray(ygm)) {
    const y = ygm as Record<string, unknown>;
    if ("yarnNotes" in y) {
      yarnGauge = {
        ...yarnGauge,
        yarnName: typeof y.yarnNotes === "string" ? y.yarnNotes : String(y.yarnNotes ?? ""),
      };
    }
    if ("yarnWeight" in y) {
      yarnGauge = {
        ...yarnGauge,
        yarnWeight: typeof y.yarnWeight === "string" ? y.yarnWeight : String(y.yarnWeight ?? ""),
      };
    }
    if ("gaugeStitchesPerInch" in y) {
      const v = y.gaugeStitchesPerInch;
      yarnGauge = { ...yarnGauge, stitchGauge: v !== undefined && v !== null ? String(v) : "" };
    }
    if ("gaugeRowsPerInch" in y) {
      const v = y.gaugeRowsPerInch;
      yarnGauge = { ...yarnGauge, rowGauge: v !== undefined && v !== null ? String(v) : "" };
    }
    if ("gaugeStitchRaw" in y) {
      const v = y.gaugeStitchRaw;
      yarnGauge = { ...yarnGauge, gaugeStitchRaw: v !== undefined && v !== null ? String(v) : "" };
    }
    if ("gaugeRowRaw" in y) {
      const v = y.gaugeRowRaw;
      yarnGauge = { ...yarnGauge, gaugeRowRaw: v !== undefined && v !== null ? String(v) : "" };
    }
    if ("gaugeRawUnit" in y) {
      const u = y.gaugeRawUnit;
      yarnGauge = {
        ...yarnGauge,
        gaugeRawUnit: u === "cm" || u === "in" ? u : "",
      };
    }
    yarnGauge.gaugeUnits = "per_inch";
    if ("availableNeedles" in y) {
      const v = y.availableNeedles;
      machine = { ...machine, availableNeedles: v !== undefined && v !== null ? String(v) : "" };
    }
  }
  return { ...base, style: st, fit: ft, yarnGauge, machine };
}

/** Shape expected by {@link generateSleevelessBackPattern}. */
export function buildGeneratorPatternDataFromSources(
  merged: Record<string, unknown>,
  patternBuilderData: Record<string, unknown>,
): Record<string, unknown> {
  const pb = patternBuilderData;
  const fitMerged = { ...sectionPattern(merged.fit), ...sectionPattern(pb.fit) };
  const smA = sectionPattern(fitMerged.selectedMeasurements);
  const smB = sectionPattern(sectionPattern(pb.fit).selectedMeasurements);
  const fit = {
    ...fitMerged,
    selectedMeasurements: { ...smB, ...smA },
  };
  const style = { ...sectionPattern(merged.style), ...sectionPattern(pb.style) };
  const ygm =
    pb.yarnGaugeMachine && typeof pb.yarnGaugeMachine === "object"
      ? sectionPattern(pb.yarnGaugeMachine)
      : {};
  const ygMerged = sectionPattern(merged.yarnGauge);
  return {
    fit,
    style,
    yarnGaugeMachine: {
      gaugeStitchesPerInch: ygm.gaugeStitchesPerInch ?? ygMerged.stitchGauge,
      gaugeRowsPerInch: ygm.gaugeRowsPerInch ?? ygMerged.rowGauge,
      availableNeedles: ygm.availableNeedles ?? sectionPattern(merged.machine).availableNeedles,
    },
  };
}
