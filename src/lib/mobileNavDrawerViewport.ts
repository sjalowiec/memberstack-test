/**
 * Mobile nav drawer sizing against the *visible* viewport.
 *
 * On phones, layout/`100dvh` can be taller than what the user can see (browser
 * chrome). Prefer `visualViewport.height`, with CSS `100svh` as the no-JS fallback.
 */

export const MOBILE_DRAWER_MAX_HEIGHT_VAR = "--mobile-drawer-max-height";

/** Prefer visualViewport height; fall back to innerHeight (or similar). */
export function resolveVisibleViewportHeight(
  visualViewportHeight: number | null | undefined,
  fallbackHeight: number,
): number {
  if (
    typeof visualViewportHeight === "number" &&
    Number.isFinite(visualViewportHeight) &&
    visualViewportHeight > 0
  ) {
    return visualViewportHeight;
  }
  return Math.max(0, fallbackHeight);
}

/**
 * Available drawer height from the measured header bottom edge to the bottom
 * of the visible viewport.
 */
export function resolveMobileDrawerMaxHeightPx(
  visibleViewportHeight: number,
  headerBottomPx: number,
): number {
  return Math.max(0, Math.round(visibleViewportHeight - Math.max(0, headerBottomPx)));
}

export type MobileDrawerViewportSyncInput = {
  visualViewportHeight: number | null | undefined;
  fallbackViewportHeight: number;
  headerBottomPx: number;
};

export function computeMobileDrawerMaxHeightPx(
  input: MobileDrawerViewportSyncInput,
): number {
  const visible = resolveVisibleViewportHeight(
    input.visualViewportHeight,
    input.fallbackViewportHeight,
  );
  return resolveMobileDrawerMaxHeightPx(visible, input.headerBottomPx);
}

export type AttachMobileDrawerViewportListenersOptions = {
  onSync: () => void;
  /** Browser window (or test double). */
  windowTarget: {
    addEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => void;
    removeEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ) => void;
  };
  /** `window.visualViewport` when available. */
  visualViewport?: {
    addEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => void;
    removeEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ) => void;
  } | null;
};

/**
 * Keep drawer height in sync with chrome show/hide and visual viewport shifts.
 * Returns a disposer that removes the listeners.
 */
export function attachMobileDrawerViewportListeners(
  options: AttachMobileDrawerViewportListenersOptions,
): () => void {
  const { onSync, windowTarget, visualViewport } = options;

  windowTarget.addEventListener("resize", onSync, { passive: true });

  if (visualViewport) {
    visualViewport.addEventListener("resize", onSync);
    visualViewport.addEventListener("scroll", onSync);
  }

  return () => {
    windowTarget.removeEventListener("resize", onSync);
    if (visualViewport) {
      visualViewport.removeEventListener("resize", onSync);
      visualViewport.removeEventListener("scroll", onSync);
    }
  };
}
