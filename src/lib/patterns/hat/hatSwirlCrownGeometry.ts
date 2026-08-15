/**
 * Shared Swirl crown wedge geometry for Stitches & Rows and Shaping Notation.
 *
 * One-sided right-triangle / sawtooth sections: leading edge is vertical
 * (non-decrease); trailing edge is the sole diagonal decrease edge. All
 * decrease edges share the same rotational direction.
 */

/** Fallback when `HatSpiralPlan.decreasePoints` is unavailable. */
export const SWIRL_CROWN_SECTION_COUNT_FALLBACK = 6;

/** Trailing = right-hand sloping edge when sections read left → right. */
export const SWIRL_DECREASE_EDGE = "trailing" as const;

export type SwirlDecreaseEdge = typeof SWIRL_DECREASE_EDGE;

/** 1-based representative section (same pale fill role as four-gore #2). */
export const SWIRL_REPRESENTATIVE_SECTION = 2;

export type SwirlSectionGeometry = {
  /** 1-based section index. */
  index: number;
  left: number;
  right: number;
  tipY: number;
  bodyTop: number;
  decreaseEdge: SwirlDecreaseEdge;
  nonDecreaseEdge: "leading";
  /** Closed path for this right-triangle section. */
  pathD: string;
};

export type SwirlCrownGeometry = {
  sectionCount: number;
  decreaseEdge: SwirlDecreaseEdge;
  tipY: number;
  bodyTop: number;
  hatLeft: number;
  hatWidth: number;
  /** Space-separated `x,y` pairs for the sawtooth outline polyline. */
  outlinePoints: string;
  sections: SwirlSectionGeometry[];
  representativeIndex: number;
};

function fmtDefault(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const r = Math.round(n * 100) / 100;
  return String(r);
}

/**
 * Build directional one-sided swirl section geometry.
 * `sectionCount` should come from `HatSpiralPlan.decreasePoints`.
 */
export function buildSwirlCrownGeometry(opts: {
  hatLeft: number;
  hatWidth: number;
  tipY: number;
  bodyTop: number;
  sectionCount: number;
  representativeIndex?: number;
  fmt?: (n: number) => string;
}): SwirlCrownGeometry {
  const fmt = opts.fmt ?? fmtDefault;
  const sectionCount = Math.max(
    1,
    Math.floor(
      opts.sectionCount > 0 ? opts.sectionCount : SWIRL_CROWN_SECTION_COUNT_FALLBACK,
    ),
  );
  const { hatLeft, hatWidth, tipY, bodyTop } = opts;
  const representativeIndex = Math.min(
    sectionCount,
    Math.max(1, opts.representativeIndex ?? SWIRL_REPRESENTATIVE_SECTION),
  );

  const outlinePts: string[] = [`${fmt(hatLeft)},${fmt(bodyTop)}`];
  const sections: SwirlSectionGeometry[] = [];

  for (let i = 0; i < sectionCount; i += 1) {
    const left = hatLeft + (hatWidth * i) / sectionCount;
    const right = hatLeft + (hatWidth * (i + 1)) / sectionCount;
    outlinePts.push(`${fmt(left)},${fmt(tipY)}`);
    outlinePts.push(`${fmt(right)},${fmt(bodyTop)}`);

    const pathD = [
      `M ${fmt(left)} ${fmt(bodyTop)}`,
      `L ${fmt(left)} ${fmt(tipY)}`,
      `L ${fmt(right)} ${fmt(bodyTop)}`,
      "Z",
    ].join(" ");

    sections.push({
      index: i + 1,
      left,
      right,
      tipY,
      bodyTop,
      decreaseEdge: SWIRL_DECREASE_EDGE,
      nonDecreaseEdge: "leading",
      pathD,
    });
  }

  return {
    sectionCount,
    decreaseEdge: SWIRL_DECREASE_EDGE,
    tipY,
    bodyTop,
    hatLeft,
    hatWidth,
    outlinePoints: outlinePts.join(" "),
    sections,
    representativeIndex,
  };
}
