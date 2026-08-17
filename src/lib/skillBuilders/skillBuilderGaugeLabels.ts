export const SKILL_BUILDER_STITCH_GAUGE_LABEL = "Sts (4″/10 cm)";
export const SKILL_BUILDER_ROW_GAUGE_LABEL = "Rows (4″/10 cm)";

export type SkillBuilderDisplayUnit = "in" | "cm";

export type SkillBuilderGaugeLabels = {
  stitch: string;
  row: string;
};

/**
 * Gauge field labels for Skill Builders. Combined 4″ / 10 cm copy is fixed:
 * switching the rest of the worksheet between inches and centimeters must not
 * change these labels (or convert the stored swatch counts).
 */
export function skillBuilderGaugeLabels(
  _unit: SkillBuilderDisplayUnit,
): SkillBuilderGaugeLabels {
  return {
    stitch: SKILL_BUILDER_STITCH_GAUGE_LABEL,
    row: SKILL_BUILDER_ROW_GAUGE_LABEL,
  };
}
