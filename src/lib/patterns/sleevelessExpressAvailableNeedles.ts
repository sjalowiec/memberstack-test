/** DOM id for Express gauge-step available needles input. */
export const EXPRESS_AVAILABLE_NEEDLES_INPUT_ID = "express-available-needles";

/** Default when the knitter has not entered a needle count. */
export const EXPRESS_DEFAULT_AVAILABLE_NEEDLES = "150";

/** True when the knitter entered a positive needle count (Express gauge step). */
export function isValidExpressAvailableNeedles(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0;
}

/**
 * Resolved needle count for Express storage (string, digits only when from presets/default).
 * Prefers live input, then prior `yarnGaugeMachine`, then {@link EXPRESS_DEFAULT_AVAILABLE_NEEDLES}.
 */
export function resolveExpressAvailableNeedles(
  prevYarnGaugeMachine: Record<string, unknown> | undefined,
  inputValue?: string,
): string {
  const fromInput = (inputValue ?? "").trim();
  if (fromInput) return fromInput;

  const raw = prevYarnGaugeMachine?.availableNeedles;
  if (raw != null && String(raw).trim() !== "") {
    return String(raw).trim();
  }

  return EXPRESS_DEFAULT_AVAILABLE_NEEDLES;
}

/** Needle count stored on the Express wizard snapshot (resume). */
export function resolveExpressAvailableNeedlesForResume(
  persistedNeedles: string | undefined,
  prevYarnGaugeMachine: Record<string, unknown> | undefined,
): string {
  const fromSession = (persistedNeedles ?? "").trim();
  if (fromSession) return fromSession;
  return resolveExpressAvailableNeedles(prevYarnGaugeMachine);
}
