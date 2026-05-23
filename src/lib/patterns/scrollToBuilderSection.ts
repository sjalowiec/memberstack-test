/**
 * Scroll a section/header into view after layout/DOM updates (accordion open, sibling collapse).
 * Pair with `scroll-margin-top` on the target (express steps, pattern sections — see layout CSS).
 */
export function scrollToBuilderSection(sectionEl: HTMLElement | null | undefined): void {
  if (!sectionEl) return;
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      sectionEl.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
  });
}
