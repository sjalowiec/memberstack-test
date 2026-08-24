/**
 * Approved Cardigan LEFT FRONT Round neckline: one-sided quarter-ellipse scoop.
 *
 * Shared by Cardigan Round Stitches & Rows and Shaping Notation so both
 * layers use the same CF → shoulder cubic (not a pinched U, not a clipped
 * pullover scoop).
 */

export const CARDIGAN_ROUND_SCOOP_KAPPA = 0.55228475;

export type CardiganRoundNeckCurveFrame = {
  neckLeft: number;
  neckRight: number;
  neckStartY: number;
  neckCornerY: number;
};

export type CardiganRoundNeckCubic = {
  startX: number;
  startY: number;
  cp1x: number;
  cp1y: number;
  cp2x: number;
  cp2y: number;
  endX: number;
  endY: number;
};

export function formatCardiganRoundSvgNum(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 100) / 100);
}

/**
 * One-sided Cardigan Round scoop: CF at neck start → shoulder neck point.
 * Quarter-ellipse handles (κ ≈ 0.552) leave CF horizontally and arrive
 * vertically at the shoulder — half of a crew neck, not a clipped pullover U.
 */
export function cardiganRoundNecklineCubic(
  frame: CardiganRoundNeckCurveFrame,
): CardiganRoundNeckCubic {
  const width = Math.max(0, frame.neckRight - frame.neckLeft);
  const depth = Math.max(0, frame.neckStartY - frame.neckCornerY);
  return {
    startX: frame.neckLeft,
    startY: frame.neckStartY,
    cp1x: frame.neckLeft + CARDIGAN_ROUND_SCOOP_KAPPA * width,
    cp1y: frame.neckStartY,
    cp2x: frame.neckRight,
    cp2y: frame.neckStartY - CARDIGAN_ROUND_SCOOP_KAPPA * depth,
    endX: frame.neckRight,
    endY: frame.neckCornerY,
  };
}

export function cardiganRoundNecklineCubicD(
  cubic: CardiganRoundNeckCubic,
  fmt: (n: number) => string = formatCardiganRoundSvgNum,
): string {
  return `C ${fmt(cubic.cp1x)} ${fmt(cubic.cp1y)} ${fmt(cubic.cp2x)} ${fmt(cubic.cp2y)} ${fmt(cubic.endX)} ${fmt(cubic.endY)}`;
}

export function cardiganRoundNecklineCurveD(
  frame: CardiganRoundNeckCurveFrame,
  fmt: (n: number) => string = formatCardiganRoundSvgNum,
): string {
  const cubic = cardiganRoundNecklineCubic(frame);
  return `M ${fmt(cubic.startX)} ${fmt(cubic.startY)} ${cardiganRoundNecklineCubicD(cubic, fmt)}`;
}

function bezier1d(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/** Scoop edge X at a canvas Y (binary-search the cubic; Y decreases toward the shoulder). */
export function cardiganRoundScoopXAtY(
  frame: CardiganRoundNeckCurveFrame,
  y: number,
): number {
  const cubic = cardiganRoundNecklineCubic(frame);
  if (y >= cubic.startY) return cubic.startX;
  if (y <= cubic.endY) return cubic.endX;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    const yt = bezier1d(cubic.startY, cubic.cp1y, cubic.cp2y, cubic.endY, mid);
    if (yt > y) lo = mid;
    else hi = mid;
  }
  const t = (lo + hi) / 2;
  return bezier1d(cubic.startX, cubic.cp1x, cubic.cp2x, cubic.endX, t);
}
