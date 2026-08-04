/** Mobile /videos toolbar: expand/collapse filter disclosure (not sticky/modal). */

export const VIDEO_FILTERS_PANEL_ID = "videoFiltersPanel";
export const VIDEO_FILTERS_TOGGLE_ID = "videoFiltersToggle";

export const VIDEO_SEARCH_PLACEHOLDER_MOBILE = "Search videos.";
export const VIDEO_SEARCH_PLACEHOLDER_DESKTOP = "Search by title or description";

export type VideoFiltersDisclosureElements = {
  toggle: HTMLElement;
  panel: HTMLElement;
};

export function isVideoFiltersPanelExpanded(panel: HTMLElement): boolean {
  return !panel.hasAttribute("hidden");
}

export function setVideoFiltersPanelExpanded(
  els: VideoFiltersDisclosureElements,
  expanded: boolean,
): void {
  const { toggle, panel } = els;
  if (expanded) {
    panel.removeAttribute("hidden");
  } else {
    panel.setAttribute("hidden", "");
  }
  toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  toggle.classList.toggle("is-expanded", expanded);
}

export function toggleVideoFiltersPanel(els: VideoFiltersDisclosureElements): boolean {
  const next = !isVideoFiltersPanelExpanded(els.panel);
  setVideoFiltersPanelExpanded(els, next);
  return next;
}

export function syncVideoSearchPlaceholder(
  input: HTMLInputElement,
  isMobile: boolean,
): void {
  input.placeholder = isMobile
    ? VIDEO_SEARCH_PLACEHOLDER_MOBILE
    : VIDEO_SEARCH_PLACEHOLDER_DESKTOP;
}

/**
 * Desktop always shows the filter panel (CSS overrides [hidden]).
 * Mobile starts collapsed; resize back to mobile re-collapses.
 */
export function syncVideoFiltersLayoutForViewport(
  els: VideoFiltersDisclosureElements,
  isMobile: boolean,
): void {
  if (!isMobile) {
    setVideoFiltersPanelExpanded(els, true);
    return;
  }
  setVideoFiltersPanelExpanded(els, false);
}
