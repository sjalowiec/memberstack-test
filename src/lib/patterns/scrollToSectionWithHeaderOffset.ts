/**
 * Scroll a just-opened builder/accordion section so its top sits just BELOW the fixed site
 * header (`.kbm-header-wrap`) instead of being hidden underneath it.
 *
 * Why not plain `scrollIntoView`: the site header is `position: fixed`, so `block: "start"`
 * parks the section flush against the viewport top — directly under the header. This helper
 * subtracts the live header height so the section content is fully visible.
 *
 * - Measures the header height on every call (it varies with the beta banner, the dev env
 *   banner, and responsive breakpoints) and falls back to a safe constant when it can't read it.
 * - Waits two animation frames so sibling-collapse / body-reveal layout settles before measuring,
 *   matching the timing of `scrollToBuilderSection`.
 * - Honors `prefers-reduced-motion`. Works the same on desktop and mobile (window-level scroll).
 */
const FALLBACK_HEADER_OFFSET_PX = 120;
const GAP_BELOW_HEADER_PX = 16;

/** Live height of the fixed site header, with a safe fallback when it can't be measured. */
function measureStickyHeaderHeight(): number {
  if (typeof document === "undefined") return FALLBACK_HEADER_OFFSET_PX;
  const header = document.querySelector(".kbm-header-wrap");
  if (header instanceof HTMLElement) {
    const h = header.getBoundingClientRect().height;
    if (Number.isFinite(h) && h > 0) return h;
  }
  return FALLBACK_HEADER_OFFSET_PX;
}

export function scrollToSectionWithHeaderOffset(
  sectionEl: HTMLElement | null | undefined,
): void {
  if (!sectionEl || typeof window === "undefined") return;
  const reduce =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const offset = measureStickyHeaderHeight() + GAP_BELOW_HEADER_PX;
      const top = sectionEl.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
    });
  });
}
