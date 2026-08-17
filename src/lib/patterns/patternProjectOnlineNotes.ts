/**
 * Shared online "Project notes" display for finished custom pattern pages.
 * Shows the block only when there is non-whitespace note text.
 */

export type PatternProjectOnlineNotesSelectors = {
  wrap: string;
  block: string;
  text: string;
};

export const SLEEVELESS_PATTERN_ONLINE_NOTES_SELECTORS: PatternProjectOnlineNotesSelectors = {
  wrap: "[data-sleeveless-pattern-online-notes-wrap]",
  block: "[data-sleeveless-pattern-online-notes]",
  text: "[data-sleeveless-pattern-online-notes-text]",
};

export const HAT_PATTERN_ONLINE_NOTES_SELECTORS: PatternProjectOnlineNotesSelectors = {
  wrap: "[data-hat-pattern-online-notes-wrap]",
  block: "[data-hat-pattern-online-notes]",
  text: "[data-hat-pattern-online-notes-text]",
};

export function applyPatternProjectOnlineNotes(
  notes: string | null | undefined,
  options: {
    root?: ParentNode;
    selectors?: PatternProjectOnlineNotesSelectors;
  } = {},
): void {
  const root = options.root ?? document;
  const selectors = options.selectors ?? SLEEVELESS_PATTERN_ONLINE_NOTES_SELECTORS;
  const notesWrap = root.querySelector(selectors.wrap);
  const notesBlock = root.querySelector(selectors.block);
  const notesText = root.querySelector(selectors.text);

  const value = notes ?? "";
  const show = value.trim().length > 0;

  if (notesWrap instanceof HTMLElement) {
    if (show) notesWrap.removeAttribute("hidden");
    else notesWrap.setAttribute("hidden", "");
  }

  if (notesBlock instanceof HTMLElement && notesText instanceof HTMLElement) {
    if (show) {
      notesText.textContent = value;
      notesBlock.removeAttribute("hidden");
    } else {
      notesText.textContent = "";
      notesBlock.setAttribute("hidden", "");
    }
  }
}
