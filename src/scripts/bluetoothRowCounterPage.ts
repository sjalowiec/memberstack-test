/**
 * Wires the DEV Bluetooth row-counter page to on-screen buttons and keyboard events.
 * Arrow handling lives in `src/lib/dev/bluetoothRowCounter.ts`.
 */
import {
  applyRowCounterKey,
  formatDetectedKeyboardCommand,
  interpretRowCounterKey,
  pushCommandLog,
  stepRowCount,
  type RowCounterKeyInput,
} from "../lib/dev/bluetoothRowCounter";

function required<T extends Element>(root: ParentNode, selector: string): T | null {
  const el = root.querySelector(selector);
  return el instanceof Element ? (el as T) : null;
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

export function mountBluetoothRowCounter(doc: Document): void {
  const root = required<HTMLElement>(doc, "[data-row-counter]");
  const countEl = required<HTMLElement>(doc, "[data-row-count]");
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
    !countEl ||
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
  if (root.dataset.rowCounterBound === "true") return;
  root.dataset.rowCounterBound = "true";

  let rows = 0;
  let log: string[] = [];
  let listening = false;

  const renderCount = (): void => {
    countEl.textContent = String(rows);
    minusBtn.disabled = rows === 0;
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

  const clearCommand = (): void => {
    lastEl.textContent = "None yet";
    detailEl.textContent = "";
    log = [];
    renderLog();
  };

  plusBtn.addEventListener("click", () => {
    markListening();
    rows = stepRowCount(rows, "advance");
    renderCount();
  });

  minusBtn.addEventListener("click", () => {
    markListening();
    rows = stepRowCount(rows, "reverse");
    renderCount();
  });

  resetBtn.addEventListener("click", () => {
    markListening();
    rows = 0;
    renderCount();
    clearCommand();
  });

  const onKeyDown = (event: KeyboardEvent): void => {
    const result = applyRowCounterKey(rows, keyInputFromEvent(event));
    if (result.decision.preventScroll) event.preventDefault();
    if (result.decision.ignore || !result.decision.command) return;
    markListening();
    rows = result.rows;
    renderCount();
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
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("input, textarea, select, button")) return;
    root.focus({ preventScroll: true });
    markListening();
  });

  renderCount();
}
