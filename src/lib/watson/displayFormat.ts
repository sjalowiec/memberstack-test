/** Helpers for blank-safe Watson table and summary display text. */

export const WATSON_DISPLAY_SEPARATOR = " - ";

export const WATSON_REPLACEMENT_CHARACTER = "\uFFFD";

export function formatWatsonTableCell(value: string | null | undefined): string {
  if (value == null) {
    return "";
  }
  const text = String(value).trim();
  return text.includes(WATSON_REPLACEMENT_CHARACTER) ? "" : text;
}

export function joinWatsonDisplayParts(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => formatWatsonTableCell(part))
    .filter(Boolean)
    .join(WATSON_DISPLAY_SEPARATOR);
}

export function assertWatsonDisplayText(value: string, context: string): string {
  if (value.includes(WATSON_REPLACEMENT_CHARACTER)) {
    throw new Error(`Watson display text must not contain U+FFFD (${context}).`);
  }
  return value;
}
