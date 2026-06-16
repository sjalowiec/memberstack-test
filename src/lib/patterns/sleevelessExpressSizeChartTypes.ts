/** Mirrors Fit step chart JSON rows (same as SleevelessGarmentFitStep). */
export type ChartRow = {
  size?: unknown;
  bust_or_chest?: unknown;
  waist?: unknown;
  hip?: unknown;
  garment_back_length?: unknown;
  armhole_depth?: unknown;
  shoulder_width?: unknown;
  neck_opening?: unknown;
  front_neck_depth?: unknown;
  back_neck_depth?: unknown;
  /** Sleeve measurements — used by sleeved constructions (e.g. drop shoulder). */
  upper_arm?: unknown;
  wrist?: unknown;
  sleeve_length?: unknown;
};
