/**
 * Shared Skill Builder print control. Uses the browser print dialog
 * (`window.print()`). Markup to omit from the sheet is marked with
 * `data-sb-print-hide`; styles live in `src/styles/skill-builders-print.css`.
 */

export const SKILL_BUILDER_PRINT_BUTTON_ATTR = "data-sb-print-button";

const BOUND_FLAG = "__kbmSkillBuilderPrintBound";

type PrintBoundWindow = Window & { [BOUND_FLAG]?: boolean };

export function printSkillBuilder(): void {
  window.print();
}

function printButtonFromEvent(event: Event): Element | null {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  return target.closest(`[${SKILL_BUILDER_PRINT_BUTTON_ATTR}]`);
}

/** Event delegation so the control still works after the member gate clones it. */
export function bindSkillBuilderPrintButtons(): void {
  if (typeof document === "undefined") return;
  const w = window as PrintBoundWindow;
  if (w[BOUND_FLAG]) return;
  w[BOUND_FLAG] = true;

  document.addEventListener("click", (event) => {
    if (!printButtonFromEvent(event)) return;
    event.preventDefault();
    printSkillBuilder();
  });
}

/** Reset the bind-once flag in tests. */
export function resetSkillBuilderPrintBindForTests(): void {
  if (typeof window === "undefined") return;
  delete (window as PrintBoundWindow)[BOUND_FLAG];
}
