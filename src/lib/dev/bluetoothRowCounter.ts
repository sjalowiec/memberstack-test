/**
 * Pure row-counter rules for the Bluetooth pedal experiment.
 * Counts the arrow keys a page-turner actually sends. It does not guess
 * whether a pedal press was a single or a double press.
 */

export type RowCounterDirection = "advance" | "reverse";

export interface RowCounterEventTarget {
  tagName?: string;
  isContentEditable?: boolean;
}

export interface RowCounterKeyInput {
  key: string;
  code?: string;
  keyCode?: number;
  repeat?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  target?: RowCounterEventTarget | null;
}

export interface DetectedKeyboardCommand {
  /** Short label such as "Right Arrow" or "Page Down". */
  label: string;
  key: string;
  code: string;
  /** DOM keyCode when the browser supplied one. 0 when absent. */
  keyCode: number;
  repeat: boolean;
  /** Set only when this event should change the row. */
  direction: RowCounterDirection | null;
}

export interface RowCounterKeyDecision {
  /** True when the event must not change the counter or the command display. */
  ignore: boolean;
  /** True when this arrow must not scroll the page. */
  preventScroll: boolean;
  command: DetectedKeyboardCommand | null;
}

const ARROW_KEYS: Record<string, { label: string; direction: RowCounterDirection }> = {
  ArrowRight: { label: "Right Arrow", direction: "advance" },
  ArrowDown: { label: "Down Arrow", direction: "advance" },
  ArrowLeft: { label: "Left Arrow", direction: "reverse" },
  ArrowUp: { label: "Up Arrow", direction: "reverse" },
};

/** Legacy keyCodes, used when a mobile browser leaves `key` unidentified. */
const KEY_CODE_TO_ARROW: Record<number, string> = {
  37: "ArrowLeft",
  38: "ArrowUp",
  39: "ArrowRight",
  40: "ArrowDown",
};

const NAMED_KEYS: Record<string, string> = {
  " ": "Space",
  Escape: "Escape",
  Enter: "Enter",
  Tab: "Tab",
  Backspace: "Backspace",
  PageDown: "Page Down",
  PageUp: "Page Up",
  Home: "Home",
  End: "End",
  Unidentified: "Unidentified",
};

export const KEYBOARD_COMMAND_LOG_LIMIT = 8;

export function normalizeRowCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

export function stepRowCount(current: number, direction: RowCounterDirection): number {
  const base = normalizeRowCount(current);
  const next = direction === "advance" ? base + 1 : base - 1;
  return next < 0 ? 0 : next;
}

/** True while the user is editing text, so arrows can move the caret. */
export function isRowCounterTextEntryTarget(
  target: RowCounterEventTarget | null | undefined,
): boolean {
  if (!target) return false;
  if (target.isContentEditable === true) return true;
  const tag = String(target.tagName || "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function isButtonActivation(
  target: RowCounterEventTarget | null | undefined,
  key: string,
): boolean {
  if (key !== " " && key !== "Enter") return false;
  return String(target?.tagName || "").toUpperCase() === "BUTTON";
}

function hasModifier(input: RowCounterKeyInput): boolean {
  return !!(input.altKey || input.ctrlKey || input.metaKey || input.shiftKey);
}

function resolveArrowKey(input: RowCounterKeyInput): string | null {
  if (ARROW_KEYS[input.key]) return input.key;
  if (input.code && ARROW_KEYS[input.code]) return input.code;
  if (typeof input.keyCode === "number" && KEY_CODE_TO_ARROW[input.keyCode]) {
    return KEY_CODE_TO_ARROW[input.keyCode];
  }
  return null;
}

function labelForNonArrow(key: string): string {
  if (Object.prototype.hasOwnProperty.call(NAMED_KEYS, key)) return NAMED_KEYS[key];
  if (!key) return "(no key)";
  return key;
}

export function interpretRowCounterKey(input: RowCounterKeyInput): RowCounterKeyDecision {
  if (isRowCounterTextEntryTarget(input.target)) {
    return { ignore: true, preventScroll: false, command: null };
  }
  if (isButtonActivation(input.target, input.key)) {
    return { ignore: true, preventScroll: false, command: null };
  }

  const arrowKey = resolveArrowKey(input);
  const arrow = arrowKey ? ARROW_KEYS[arrowKey] : null;
  const repeat = !!input.repeat;
  const modified = hasModifier(input);
  let label = arrow ? arrow.label : labelForNonArrow(input.key);
  let direction: RowCounterDirection | null = arrow && !repeat && !modified ? arrow.direction : null;
  if (arrow && repeat) label = `${arrow.label} (held, not counted)`;
  else if (arrow && modified) label = `${arrow.label} (modifier, not counted)`;

  return {
    ignore: false,
    preventScroll: !!arrow && !modified,
    command: {
      label,
      key: input.key,
      code: input.code || "",
      keyCode: typeof input.keyCode === "number" && input.keyCode > 0 ? input.keyCode : 0,
      repeat,
      direction,
    },
  };
}

export function rowCountAfterKey(current: number, decision: RowCounterKeyDecision): number {
  const rows = normalizeRowCount(current);
  if (decision.ignore || !decision.command?.direction) return rows;
  return stepRowCount(rows, decision.command.direction);
}

export function applyRowCounterKey(
  current: number,
  input: RowCounterKeyInput,
): { rows: number; decision: RowCounterKeyDecision } {
  const decision = interpretRowCounterKey(input);
  return { rows: rowCountAfterKey(current, decision), decision };
}

export function formatDetectedKeyboardCommand(command: DetectedKeyboardCommand): {
  title: string;
  detail: string;
} {
  const detailParts = [`key ${command.key || "none"}`, `code ${command.code || "none"}`];
  if (command.keyCode > 0) detailParts.push(`keyCode ${command.keyCode}`);
  return { title: command.label, detail: detailParts.join(" · ") };
}

export function pushCommandLog(log: readonly string[], entry: string, limit = KEYBOARD_COMMAND_LOG_LIMIT): string[] {
  return [...log, entry].slice(-limit);
}
