/**
 * Smooth-scroll to a builder accordion section after layout/DOM updates.
 * Pair with `scroll-margin-top` on `[data-express-step]` (see sleeveless-express-wizard-layout.css).
 */
export function scrollToBuilderSection(sectionEl: HTMLElement | null | undefined): void {
  if (!sectionEl) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      sectionEl.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}
