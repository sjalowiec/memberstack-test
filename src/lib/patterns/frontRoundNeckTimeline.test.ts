import { describe, expect, it } from "vitest";
import { calculateRoundFrontNeckline } from "./legoBlocks/roundFrontNeckline";
import { rowEntriesFromRoundFrontNecklineResult } from "./frontRoundNeckTimeline";

describe("rowEntriesFromRoundFrontNecklineResult", () => {
  it("emits exactly neckDepthRows RowEntries for RC startRC .. startRC + neckDepthRows - 1", () => {
    const round = calculateRoundFrontNeckline({
      necklineStitches: 53,
      neckDepthRows: 55,
      startRC: 247,
      shoulderStitchesPerSide: 38,
    });
    const entries = rowEntriesFromRoundFrontNecklineResult({
      round,
      necklineStitches: 53,
      shoulderStitchesPerSide: 38,
      startRC: 247,
      neckDepthRows: 55,
    });
    expect(entries).toHaveLength(55);
    expect(entries[0]!.row).toBe(247);
    expect(entries[54]!.row).toBe(301);
    expect(entries[0]!.events.some((e) => e.side === "center")).toBe(true);
    const gradualPlain = entries.filter(
      (e) =>
        e.row >= round.gradualStartRC &&
        e.row < round.gradualStartRC + round.gradualRows &&
        e.events.length === 0
    );
    expect(gradualPlain.length).toBeGreaterThan(0);
  });

  it("uses empty events on plain neck rows and preserves stitch counts", () => {
    const round = calculateRoundFrontNeckline({
      necklineStitches: 15,
      neckDepthRows: 12,
      startRC: 100,
      shoulderStitchesPerSide: 10,
    });
    const entries = rowEntriesFromRoundFrontNecklineResult({
      round,
      necklineStitches: 15,
      shoulderStitchesPerSide: 10,
      startRC: 100,
      neckDepthRows: 12,
    });
    expect(entries).toHaveLength(12);
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1]!;
      const cur = entries[i]!;
      if (cur.events.length === 0) {
        expect(cur.stitchesL).toBe(prev.stitchesL);
        expect(cur.stitchesR).toBe(prev.stitchesR);
      }
    }
  });
});
