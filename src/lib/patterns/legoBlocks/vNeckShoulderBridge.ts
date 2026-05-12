/**
 * Bridge (foundation): merge V-neck inner-edge {@link ShapingEvent}s with caller-supplied shoulder
 * outer-edge events on the same RC axis — same types as {@link RowEntry.events}, no new renderer.
 * Not wired to production; round-neck paths unchanged.
 */

import type { ShapingEvent } from "../shapingTimeline";
import {
  calculateVNeckNeckEdgePlan,
  vNeckPlanToInnerEdgeEventsByRow,
  type VNeckNeckEdgeInputs,
} from "./vNeckline";

export type BuildVNeckShoulderEventsByRowOptions = VNeckNeckEdgeInputs & {
  /**
   * Outer-edge shoulder shaping events keyed by RC (e.g. excerpt from {@link buildTimeline} post-center rows).
   */
  shoulderEventsByRow?: ReadonlyMap<number, ReadonlyArray<ShapingEvent>>;
  /**
   * Same data as a list; merged with `shoulderEventsByRow` when both are set (per-RC arrays concatenate).
   */
  shoulderEvents?: ReadonlyArray<{ row: number; events: ReadonlyArray<ShapingEvent> }>;
};

function collectShoulderEventsByRow(
  shoulderEventsByRow: BuildVNeckShoulderEventsByRowOptions["shoulderEventsByRow"],
  shoulderEvents: BuildVNeckShoulderEventsByRowOptions["shoulderEvents"]
): Map<number, ShapingEvent[]> {
  const out = new Map<number, ShapingEvent[]>();
  if (shoulderEventsByRow) {
    for (const [rc, evs] of shoulderEventsByRow) {
      const row = Math.floor(rc);
      const prev = out.get(row) ?? [];
      out.set(row, [...prev, ...evs]);
    }
  }
  if (shoulderEvents) {
    for (const entry of shoulderEvents) {
      const row = Math.floor(entry.row);
      const prev = out.get(row) ?? [];
      out.set(row, [...prev, ...entry.events]);
    }
  }
  return out;
}

/**
 * Builds a per-RC map of merged shaping events: V-neck inner decreases first, then shoulder events
 * on the same RC — consistent with {@link buildTimeline} post-center row ordering (inner neck, then outer shoulder).
 */
export function buildVNeckShoulderEventsByRow(
  options: BuildVNeckShoulderEventsByRowOptions
): Map<number, ShapingEvent[]> {
  const { shoulderEventsByRow, shoulderEvents, ...neckInputs } = options;

  const plan = calculateVNeckNeckEdgePlan(neckInputs);
  const innerByRow = vNeckPlanToInnerEdgeEventsByRow(plan);
  const shoulderByRow = collectShoulderEventsByRow(shoulderEventsByRow, shoulderEvents);

  const rcSet = new Set<number>([...innerByRow.keys(), ...shoulderByRow.keys()]);
  const sortedRc = [...rcSet].sort((a, b) => a - b);
  const merged = new Map<number, ShapingEvent[]>();

  for (const rc of sortedRc) {
    const inner = innerByRow.get(rc) ?? [];
    const shoulder = shoulderByRow.get(rc) ?? [];
    const combined = [...inner, ...shoulder];
    if (combined.length > 0) {
      merged.set(rc, combined);
    }
  }

  return merged;
}
