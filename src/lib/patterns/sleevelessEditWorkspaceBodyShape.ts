/**
 * Edit Pattern Workspace — derive the persisted body-shape token from the user's edited finished
 * measurements.
 *
 * The measurement SVG editor lets the user set finished bust and finished hip directly, so the
 * stored body shape must be reclassified from those measurements on Update — otherwise a pattern
 * that was previously `aline` keeps the A-line token even after the hip is edited to match or fall
 * below the bust, and the explicit token short-circuits measurement inference for diagram routing.
 *
 * Classification (mirrors {@link resolveEffectiveSleevelessBodyShapeKind} + the body-block tolerance):
 *  - hip wider than bust beyond tolerance  → `aline`.
 *  - hip narrower than bust (reverse A-line / shaped) OR bust ≈ hip → `straight`.
 *
 * Only `straight` and `aline` are persistable through the sleeveless sync (`expressStyleKeyFor` →
 * `mapExpressStyleKey` collapse everything else to those two), so the reverse-A-line / shaped
 * diagram and math are produced by measurement inference on a `straight` token — exactly how
 * creating a new pattern with hip < bust routes. Persisting `straight` for the shaped case therefore
 * keeps edit-and-update in parity with new-pattern creation, and drops a now-stale `aline` token.
 *
 * The wide-hip suppression in {@link resolveEffectiveFinishedHipInches} /
 * {@link resolveBodyBlockHipCircumferenceInches} exists to drop *stale* leftover review overrides on
 * Express straight torsos; it stops suppressing once the stored shape is an explicit `aline`, which
 * is why a deliberate wide-hip edit must persist `aline`. Narrow hips are never suppressed, so the
 * shaped case needs no explicit token.
 *
 * Falls back to the current stored shape only when a finished measurement is missing/unparseable.
 */
import { positiveMeasurementInches } from "./customBuildEffectiveArmholeDepth";
import { measurementsImplySleevelessAlineBody } from "./sleevelessAlineShaping";

export type SleevelessEditWorkspaceBodyShape = "straight" | "aline";

export function deriveSleevelessEditWorkspaceBodyShape(
  overrides: Record<string, string | undefined> | null | undefined,
  currentBodyShape: SleevelessEditWorkspaceBodyShape,
): SleevelessEditWorkspaceBodyShape {
  const finishedBust = positiveMeasurementInches(overrides?.chestBust);
  const finishedHip = positiveMeasurementInches(overrides?.hip);
  if (finishedBust === undefined || finishedHip === undefined) return currentBodyShape;
  if (measurementsImplySleevelessAlineBody(finishedBust, finishedHip)) return "aline";
  return "straight";
}
