/**
 * Wires the DEV KnitSync pattern page to on-screen buttons and keyboard events.
 * Arrow handling is delegated to the Bluetooth row-counter rules.
 */
import {
  formatDetectedKeyboardCommand,
  interpretRowCounterKey,
  pushCommandLog,
  type RowCounterKeyInput,
} from "../lib/dev/bluetoothRowCounter";
import {
  completedRowsAfterKey,
  completedRowsAfterStep,
  KNITSYNC_SWATCH,
  selectKnitSyncInstruction,
} from "../lib/dev/knitsyncPattern";
import { shapingAlertDecision, shapingHighlightRow } from "../lib/dev/knitsyncShapingAlert";
import {
  clampKnitSyncVolume,
  completionCueDecision,
  KNITSYNC_COMPLETION_NOTES,
  KNITSYNC_DEFAULT_VOLUME,
  KNITSYNC_SHAPING_FREQUENCY,
  KNITSYNC_SHAPING_OVERTONE_MIX,
  knitSyncToneGain,
  shapingBeepEnvelope,
} from "../lib/dev/knitsyncSound";

function required<T extends Element>(root: ParentNode, selector: string): T | null {
  const el = root.querySelector(selector);
  return el instanceof Element ? (el as T) : null;
}

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

function audioConstructor(win: Window): typeof AudioContext | null {
  const audioWindow = win as AudioWindow;
  return audioWindow.AudioContext || audioWindow.webkitAudioContext || null;
}

function startTone(
  context: AudioContext,
  frequency: number,
  when: number,
  duration: number,
  peak: number,
): void {
  const osc = context.createOscillator();
  const gain = context.createGain();
  const attack = Math.min(0.03, duration * 0.25);
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start(when);
  osc.stop(when + duration + 0.02);
}

/** Shaping beep only. Fades in, holds, then fades out. The ta-da keeps startTone. */
function startShapingTone(
  context: AudioContext,
  frequency: number,
  when: number,
  peak: number,
): void {
  const envelope = shapingBeepEnvelope();
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + envelope.fadeIn);
  gain.gain.setValueAtTime(peak, when + envelope.holdUntil);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + envelope.duration);
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start(when);
  osc.stop(when + envelope.duration + 0.02);
}

/**
 * One sine beep with a quiet octave overtone.
 * Failures stay silent so a blocked AudioContext cannot stop the counter.
 */
function playShapingBeep(context: AudioContext | null, volume: number): void {
  if (!context || context.state === "closed") return;
  const peak = knitSyncToneGain(volume);
  if (peak <= 0) return;
  try {
    if (context.state === "suspended") void context.resume().catch(() => {});
    const now = context.currentTime;
    startShapingTone(context, KNITSYNC_SHAPING_FREQUENCY, now, peak);
    startShapingTone(
      context,
      KNITSYNC_SHAPING_FREQUENCY * 2,
      now,
      peak * KNITSYNC_SHAPING_OVERTONE_MIX,
    );
  } catch {
    // Autoplay blocked, or this browser has no audio output.
  }
}

/** Three-note ta-da at the same peak gain as the shaping beep. */
function playCompletionSound(context: AudioContext | null, volume: number): void {
  if (!context || context.state === "closed") return;
  const peak = knitSyncToneGain(volume);
  if (peak <= 0) return;
  try {
    if (context.state === "suspended") void context.resume().catch(() => {});
    const now = context.currentTime;
    for (const note of KNITSYNC_COMPLETION_NOTES) {
      startTone(context, note.frequency, now + note.start, note.duration, peak);
    }
  } catch {
    // Autoplay blocked, or this browser has no audio output.
  }
}

function keyInputFromEvent(event: KeyboardEvent): RowCounterKeyInput {
  const target = event.target;
  const readable =
    target && typeof target === "object"
      ? (target as { tagName?: string; isContentEditable?: boolean })
      : null;
  return {
    key: event.key,
    code: event.code,
    keyCode: event.keyCode,
    repeat: event.repeat,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    target: readable,
  };
}

export function mountKnitSyncPattern(doc: Document): void {
  const root = required<HTMLElement>(doc, "[data-knitsync]");
  const nowEl = required<HTMLElement>(doc, "[data-now]");
  const shapingFlagEl = required<HTMLElement>(doc, "[data-shaping-flag]");
  const soundBtn = required<HTMLButtonElement>(doc, "[data-sound-toggle]");
  const volumeInput = required<HTMLInputElement>(doc, "[data-volume]");
  const volumeReadout = required<HTMLElement>(doc, "[data-volume-readout]");
  const nowLabelEl = required<HTMLElement>(doc, "[data-now-label]");
  const progressEl = required<HTMLElement>(doc, "[data-progress]");
  const headingEl = required<HTMLElement>(doc, "[data-heading]");
  const metaEl = required<HTMLElement>(doc, "[data-meta]");
  const previousEl = required<HTMLElement>(doc, "[data-previous]");
  const currentEl = required<HTMLElement>(doc, "[data-current]");
  const upcomingEl = required<HTMLElement>(doc, "[data-upcoming]");
  const plusBtn = required<HTMLButtonElement>(doc, "[data-row-plus]");
  const minusBtn = required<HTMLButtonElement>(doc, "[data-row-minus]");
  const resetBtn = required<HTMLButtonElement>(doc, "[data-row-reset]");
  const lastEl = required<HTMLElement>(doc, "[data-last-command]");
  const detailEl = required<HTMLElement>(doc, "[data-last-command-detail]");
  const logEl = required<HTMLElement>(doc, "[data-command-log]");
  const emptyLogEl = required<HTMLElement>(doc, "[data-command-empty]");
  const statusEl = required<HTMLElement>(doc, "[data-pedal-status]");
  if (
    !root ||
    !nowEl ||
    !shapingFlagEl ||
    !soundBtn ||
    !volumeInput ||
    !volumeReadout ||
    !nowLabelEl ||
    !progressEl ||
    !headingEl ||
    !metaEl ||
    !previousEl ||
    !currentEl ||
    !upcomingEl ||
    !plusBtn ||
    !minusBtn ||
    !resetBtn ||
    !lastEl ||
    !detailEl ||
    !logEl ||
    !emptyLogEl ||
    !statusEl
  ) {
    return;
  }
  if (root.dataset.knitsyncBound === "true") return;
  root.dataset.knitsyncBound = "true";

  const totalRows = KNITSYNC_SWATCH.rows.length;
  const win = doc.defaultView;
  let completedRows = 0;
  let log: string[] = [];
  let listening = false;
  let soundEnabled = true;
  let volume = KNITSYNC_DEFAULT_VOLUME;
  let alertedRows: readonly number[] = [];
  let completionAnnounced = false;
  let audioContext: AudioContext | null = null;

  const unlockAudio = (): void => {
    if (!win) return;
    try {
      const Ctor = audioConstructor(win);
      if (!Ctor) return;
      if (!audioContext) audioContext = new Ctor();
      if (audioContext.state === "suspended") void audioContext.resume().catch(() => {});
    } catch {
      audioContext = null;
    }
  };

  const renderSound = (): void => {
    soundBtn.textContent = soundEnabled ? "Sound on" : "Sound off";
    soundBtn.setAttribute("aria-pressed", soundEnabled ? "true" : "false");
    const percent = Math.round(volume * 100);
    volumeInput.value = String(percent);
    volumeInput.setAttribute("aria-valuenow", String(percent));
    volumeReadout.textContent = `${percent}%`;
  };

  const render = (): void => {
    const view = selectKnitSyncInstruction(KNITSYNC_SWATCH, completedRows);
    completedRows = view.completedRows;
    const highlightRow = shapingHighlightRow(KNITSYNC_SWATCH, completedRows);
    nowLabelEl.textContent = view.complete ? "Finished" : "Next row to knit";
    progressEl.textContent = view.progressLabel;
    headingEl.textContent = view.heading;
    metaEl.textContent = view.metaLabel;
    previousEl.textContent = view.previousText;
    currentEl.textContent = view.currentText;
    upcomingEl.textContent = view.upcomingText;
    root.dataset.phase = view.complete ? "complete" : "knitting";
    nowEl.dataset.shaping = highlightRow == null ? "false" : "true";
    shapingFlagEl.hidden = highlightRow == null;
    minusBtn.disabled = !view.canReverse;
    plusBtn.disabled = !view.canAdvance;
  };

  const commitCount = (nextCompleted: number): void => {
    const fromCompleted = completedRows;
    const decision = shapingAlertDecision({
      pattern: KNITSYNC_SWATCH,
      fromCompleted,
      toCompleted: nextCompleted,
      soundEnabled,
      alertedRows,
    });
    const completion = completionCueDecision({
      totalRows,
      fromCompleted,
      toCompleted: nextCompleted,
      soundEnabled,
      completionAnnounced,
    });
    alertedRows = decision.alertedRows;
    completionAnnounced = completion.completionAnnounced;
    completedRows = nextCompleted;
    render();
    if (decision.alert) playShapingBeep(audioContext, volume);
    if (completion.play) playCompletionSound(audioContext, volume);
  };

  const renderLog = (): void => {
    logEl.replaceChildren();
    for (const entry of [...log].reverse()) {
      const item = doc.createElement("li");
      item.textContent = entry;
      logEl.append(item);
    }
    const hasEntries = log.length > 0;
    logEl.hidden = !hasEntries;
    emptyLogEl.hidden = hasEntries;
  };

  const markListening = (): void => {
    if (listening) return;
    listening = true;
    statusEl.textContent = "Listening for the pedal.";
  };

  const showCommand = (title: string, detail: string, record: boolean): void => {
    lastEl.textContent = title;
    detailEl.textContent = detail;
    if (!record) return;
    log = pushCommandLog(log, title);
    renderLog();
  };

  plusBtn.addEventListener("click", () => {
    markListening();
    unlockAudio();
    commitCount(completedRowsAfterStep(completedRows, "advance", totalRows));
  });

  minusBtn.addEventListener("click", () => {
    markListening();
    unlockAudio();
    commitCount(completedRowsAfterStep(completedRows, "reverse", totalRows));
  });

  resetBtn.addEventListener("click", () => {
    markListening();
    unlockAudio();
    alertedRows = [];
    lastEl.textContent = "None yet";
    detailEl.textContent = "";
    log = [];
    renderLog();
    commitCount(0);
  });

  soundBtn.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    renderSound();
    unlockAudio();
    markListening();
  });

  volumeInput.addEventListener("input", () => {
    volume = clampKnitSyncVolume(Number(volumeInput.value) / 100);
    renderSound();
    unlockAudio();
  });

  const releaseVolume = (): void => {
    root.focus({ preventScroll: true });
  };
  volumeInput.addEventListener("change", releaseVolume);
  volumeInput.addEventListener("keyup", releaseVolume);

  const onKeyDown = (event: KeyboardEvent): void => {
    const result = completedRowsAfterKey(completedRows, keyInputFromEvent(event), totalRows);
    if (result.decision.preventScroll) event.preventDefault();
    if (result.decision.ignore || !result.decision.command) return;
    markListening();
    unlockAudio();
    commitCount(result.completedRows);
    const view = formatDetectedKeyboardCommand(result.decision.command);
    showCommand(view.title, view.detail, !result.decision.command.repeat);
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    const decision = interpretRowCounterKey(keyInputFromEvent(event));
    if (decision.preventScroll) event.preventDefault();
  };

  doc.defaultView?.addEventListener("keydown", onKeyDown, { capture: true, passive: false });
  doc.defaultView?.addEventListener("keyup", onKeyUp, { capture: true, passive: false });

  root.addEventListener("pointerdown", (event) => {
    unlockAudio();
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("button, input")) return;
    root.focus({ preventScroll: true });
    markListening();
  });

  renderSound();
  render();
}
