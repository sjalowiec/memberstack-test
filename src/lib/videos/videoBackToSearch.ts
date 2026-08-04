/** /videos only: floating “Back to search” when the toolbar is out of view. */

export const VIDEO_BACK_TO_SEARCH_ID = "videoBackToSearch";
export const VIDEO_TOOLBAR_ID = "videoToolbar";

const FALLBACK_HEADER_OFFSET_PX = 120;
const GAP_BELOW_HEADER_PX = 12;

export function prefersReducedMotion(
  matchMedia: (query: string) => { matches: boolean } = window.matchMedia.bind(window),
): boolean {
  try {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function getVideoBackToSearchScrollBehavior(
  reduceMotion: boolean,
): ScrollBehavior {
  return reduceMotion ? "auto" : "smooth";
}

export function setVideoBackToSearchVisible(
  button: { removeAttribute(name: string): void; setAttribute(name: string, value: string): void },
  visible: boolean,
): void {
  if (visible) button.removeAttribute("hidden");
  else button.setAttribute("hidden", "");
}

/** Show the control only when the toolbar (or sentinel) is not intersecting the viewport. */
export function syncVideoBackToSearchFromIntersection(
  button: { removeAttribute(name: string): void; setAttribute(name: string, value: string): void },
  isToolbarIntersecting: boolean,
): void {
  setVideoBackToSearchVisible(button, !isToolbarIntersecting);
}

export function measureVideoPageHeaderOffsetPx(
  querySelector: (sel: string) => { getBoundingClientRect(): { height: number } } | null = (
    sel,
  ) => document.querySelector(sel),
): number {
  const header = querySelector(".kbm-header-wrap");
  if (header) {
    const h = header.getBoundingClientRect().height;
    if (Number.isFinite(h) && h > 0) return h + GAP_BELOW_HEADER_PX;
  }
  return FALLBACK_HEADER_OFFSET_PX + GAP_BELOW_HEADER_PX;
}

export type ScrollToLike = {
  scrollTo(options: { top: number; behavior?: ScrollBehavior }): void;
  scrollY: number;
};

export type RectLike = { getBoundingClientRect(): { top: number } };

export function scrollVideoToolbarIntoView(
  toolbar: RectLike,
  opts: {
    reduceMotion: boolean;
    windowLike?: ScrollToLike;
    headerOffsetPx?: number;
  },
): void {
  const win = opts.windowLike ?? window;
  const offset =
    opts.headerOffsetPx !== undefined
      ? opts.headerOffsetPx
      : measureVideoPageHeaderOffsetPx();
  const top = toolbar.getBoundingClientRect().top + win.scrollY - offset;
  win.scrollTo({
    top: Math.max(0, top),
    behavior: getVideoBackToSearchScrollBehavior(opts.reduceMotion),
  });
}

export type FocusableSearch = {
  focus(options?: { preventScroll?: boolean }): void;
};

/**
 * Focus the search field after activation. Uses preventScroll so focus does not
 * fight the toolbar scroll. Call only from the button click/keyboard handler.
 */
export function focusVideoSearchInput(input: FocusableSearch): void {
  input.focus({ preventScroll: true });
}

export function activateVideoBackToSearch(opts: {
  toolbar: RectLike;
  searchInput: FocusableSearch;
  reduceMotion: boolean;
  windowLike?: ScrollToLike & {
    addEventListener?(type: string, listener: () => void, options?: { once?: boolean }): void;
    removeEventListener?(type: string, listener: () => void): void;
    setTimeout?(handler: () => void, timeout: number): unknown;
  };
  headerOffsetPx?: number;
  /** Test hook: invoked after focus is applied. */
  afterFocus?: () => void;
}): void {
  scrollVideoToolbarIntoView(opts.toolbar, {
    reduceMotion: opts.reduceMotion,
    windowLike: opts.windowLike,
    headerOffsetPx: opts.headerOffsetPx,
  });

  const runFocus = () => {
    focusVideoSearchInput(opts.searchInput);
    opts.afterFocus?.();
  };

  if (opts.reduceMotion) {
    runFocus();
    return;
  }

  const win = opts.windowLike ?? window;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    if (typeof win.removeEventListener === "function") {
      win.removeEventListener("scrollend", finish);
    }
    runFocus();
  };

  if (typeof win.addEventListener === "function") {
    win.addEventListener("scrollend", finish, { once: true });
  }
  const schedule = win.setTimeout ?? setTimeout;
  schedule(finish, 700);
}
