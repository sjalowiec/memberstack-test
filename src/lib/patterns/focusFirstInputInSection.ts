/**
 * Focus-behavior helper (no gauge math / validation / save logic):
 * move keyboard focus to the first visible, enabled field inside a just-opened accordion body.
 *
 * - Targets the first `input`/`select`/`textarea` inside `.express-acc__body` that is enabled,
 *   keyboard-reachable (not `tabindex="-1"`), and actually rendered.
 * - Uses `focus({ preventScroll: true })` so it does not fight any smooth-scroll-into-view.
 * - No-ops when that field is already focused, so re-opening or refreshing never disrupts the user.
 */
export function focusFirstInputInSection(sectionEl: HTMLElement): void {
  const body = sectionEl.querySelector(".express-acc__body");
  if (!body) return;

  const candidates = Array.from(
    body.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      'input:not([type="hidden"]), select, textarea',
    ),
  );

  for (const el of candidates) {
    if (el.disabled) continue;
    if (el.getAttribute("tabindex") === "-1") continue;
    // Skip fields the layout has not rendered (hidden body, display:none, etc.).
    if (el.offsetParent === null && el.getClientRects().length === 0) continue;
    if (el.ownerDocument.activeElement === el) return;
    el.focus({ preventScroll: true });
    return;
  }
}
