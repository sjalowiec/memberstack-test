import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  clampKnitSyncVolume,
  completionCueDecision,
  KNITSYNC_COMPLETION_NOTES,
  KNITSYNC_DEFAULT_VOLUME,
  KNITSYNC_SHAPING_DURATION,
  shapingBeepEnvelope,
  KNITSYNC_TONE_FULL_GAIN,
  knitSyncToneGain,
} from "./knitsyncSound";

const totalRows = 20;

function cue(
  from: number,
  to: number,
  announced: boolean,
  soundEnabled = true,
) {
  return completionCueDecision({
    totalRows,
    fromCompleted: from,
    toCompleted: to,
    soundEnabled,
    completionAnnounced: announced,
  });
}

describe("KnitSync volume", () => {
  it("defaults to about 75 percent and stays louder than a faint beep without clipping", () => {
    expect(KNITSYNC_DEFAULT_VOLUME).toBeCloseTo(0.75);
    const atDefault = knitSyncToneGain(KNITSYNC_DEFAULT_VOLUME);
    expect(atDefault).toBeCloseTo(KNITSYNC_TONE_FULL_GAIN * 0.75);
    expect(atDefault).toBeGreaterThan(0.45);
    expect(atDefault).toBeLessThan(1);
    expect(knitSyncToneGain(1)).toBeGreaterThan(atDefault);
    expect(knitSyncToneGain(1)).toBeLessThanOrEqual(1);
    expect(knitSyncToneGain(0)).toBe(0);
  });

  it("clamps the volume setting", () => {
    expect(clampKnitSyncVolume(1.4)).toBe(1);
    expect(clampKnitSyncVolume(-0.2)).toBe(0);
    expect(clampKnitSyncVolume(Number.NaN)).toBe(KNITSYNC_DEFAULT_VOLUME);
    expect(knitSyncToneGain(2)).toBe(knitSyncToneGain(1));
  });

  it("holds the shaping beep for about half a second with a fade in and fade out", () => {
    expect(KNITSYNC_SHAPING_DURATION).toBeCloseTo(0.5);
    const envelope = shapingBeepEnvelope();
    expect(envelope.duration).toBeCloseTo(0.5);
    expect(envelope.fadeIn).toBeGreaterThanOrEqual(0.05);
    expect(envelope.holdUntil).toBeGreaterThan(envelope.fadeIn);
    expect(envelope.duration - envelope.holdUntil).toBeGreaterThanOrEqual(0.1);
    expect(envelope.fadeIn + (envelope.duration - envelope.holdUntil)).toBeLessThan(envelope.duration);
  });
});

describe("completion ta-da", () => {
  it("is three rising notes that share the shaping-beep volume", () => {
    expect(KNITSYNC_COMPLETION_NOTES).toHaveLength(3);
    const frequencies = KNITSYNC_COMPLETION_NOTES.map((note) => note.frequency);
    expect(frequencies[0]).toBeLessThan(frequencies[1]!);
    expect(frequencies[1]).toBeLessThan(frequencies[2]!);
    for (const note of KNITSYNC_COMPLETION_NOTES) {
      expect(note.duration).toBeGreaterThan(0);
      expect(note.duration).toBeLessThanOrEqual(0.4);
    }
    const page = readFileSync(resolve("src/scripts/knitsyncPatternPage.ts"), "utf8");
    const gainUses = page.split("knitSyncToneGain(").length - 1;
    expect(gainUses).toBeGreaterThanOrEqual(2);
  });

  it("plays once when the counter first reaches the final row", () => {
    let announced = false;
    let completed = 19;
    const go = (to: number, soundEnabled = true) => {
      const decision = cue(completed, to, announced, soundEnabled);
      announced = decision.completionAnnounced;
      completed = to;
      return decision.play;
    };

    expect(go(20)).toBe(true);
    expect(go(20)).toBe(false);
    expect(go(19)).toBe(false);
    expect(go(20)).toBe(false);
    expect(go(0)).toBe(false);
    expect(go(20)).toBe(false);
  });

  it("does not play when sound is off, and does not replay after sound is turned on", () => {
    const muted = cue(19, 20, false, false);
    expect(muted.play).toBe(false);
    expect(muted.completionAnnounced).toBe(true);
    const later = cue(19, 20, muted.completionAnnounced, true);
    expect(later.play).toBe(false);
  });
});
