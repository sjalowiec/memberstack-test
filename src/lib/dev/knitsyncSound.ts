/**
 * Loudness and completion-cue rules for the KnitSync proof of concept.
 * Playback stays in the page. Shaping-row highlight rules are unchanged.
 */
import { clampCompletedRows } from "./knitsyncPattern";

/** Slider default. About three-quarters of the full tone. */
export const KNITSYNC_DEFAULT_VOLUME = 0.75;

/**
 * Linear peak at volume 1. Strong enough to carry over carriage noise.
 * The page uses a short sine envelope so this does not clip or buzz.
 */
export const KNITSYNC_TONE_FULL_GAIN = 0.7;

/** Shaping beep pitch. */
export const KNITSYNC_SHAPING_FREQUENCY = 880;
/** About half a second, long enough to hear over the carriage. */
export const KNITSYNC_SHAPING_DURATION = 0.5;
/** Smooth edges so the longer beep does not click. */
export const KNITSYNC_SHAPING_FADE_IN = 0.08;
export const KNITSYNC_SHAPING_FADE_OUT = 0.18;
/** Quiet octave above the beep so it cuts through rumble without sounding like a buzzer. */
export const KNITSYNC_SHAPING_OVERTONE_MIX = 0.16;

export interface ShapingBeepEnvelope {
  fadeIn: number;
  /** Time, from the start, when the fade-out begins. */
  holdUntil: number;
  duration: number;
}

/** Fade in, hold, then fade out. The completion tune does not use this. */
export function shapingBeepEnvelope(
  duration = KNITSYNC_SHAPING_DURATION,
): ShapingBeepEnvelope {
  const fadeIn = Math.min(KNITSYNC_SHAPING_FADE_IN, duration * 0.3);
  const fadeOut = Math.min(KNITSYNC_SHAPING_FADE_OUT, duration * 0.45);
  return {
    fadeIn,
    holdUntil: Math.max(fadeIn, duration - fadeOut),
    duration,
  };
}

/** Rising major arpeggio: C5, E5, G5. */
export const KNITSYNC_COMPLETION_NOTES = [
  { frequency: 523.25, start: 0, duration: 0.16 },
  { frequency: 659.25, start: 0.17, duration: 0.16 },
  { frequency: 783.99, start: 0.34, duration: 0.34 },
] as const;

export interface CompletionCueInput {
  totalRows: number;
  fromCompleted: number;
  toCompleted: number;
  soundEnabled: boolean;
  /** True after the counter has already reached the final row once. */
  completionAnnounced: boolean;
}

export interface CompletionCueDecision {
  play: boolean;
  completionAnnounced: boolean;
}

export function clampKnitSyncVolume(volume: number): number {
  if (!Number.isFinite(volume)) return KNITSYNC_DEFAULT_VOLUME;
  if (volume < 0) return 0;
  if (volume > 1) return 1;
  return volume;
}

/** Peak gain for every KnitSync tone, including the shaping beep and the ta-da. */
export function knitSyncToneGain(volume: number): number {
  return KNITSYNC_TONE_FULL_GAIN * clampKnitSyncVolume(volume);
}

/**
 * Play the ta-da only the first time the counter moves forward onto the final row.
 * A rerender, a reset, or a later return to that row does not play it again.
 * Sound off still counts as the first completion, so unmuting does not replay it.
 */
export function completionCueDecision(input: CompletionCueInput): CompletionCueDecision {
  const total = clampCompletedRows(input.totalRows, Number.MAX_SAFE_INTEGER);
  const from = clampCompletedRows(input.fromCompleted, total);
  const to = clampCompletedRows(input.toCompleted, total);
  const arrived = total > 0 && to === total && to > from;
  return {
    play: input.soundEnabled && arrived && !input.completionAnnounced,
    completionAnnounced: input.completionAnnounced || arrived,
  };
}
