/**
 * Shared finished-pattern in-page section navigation (sticky pill TOC).
 * Sweater and Socks pages use the same markup contract, CSS, scroll-spy, and jump behavior.
 */

export const PATTERN_INPAGE_NAV_ATTR = "data-sleeveless-pattern-inpage-nav";
export const PATTERN_INPAGE_NAV_TRACK_CLASS = "sleeveless-pattern-inpage-nav__track";
export const PATTERN_INPAGE_NAV_PILL_CLASS = "sleeveless-pattern-inpage-nav__pill";
/** Section-link scroller inside the shared sticky nav. Actions stay outside this track. */
export const PATTERN_INPAGE_NAV_SECTIONS_ATTR = "data-saved-pattern-sticky-nav-sections";
export const PATTERN_INPAGE_NAV_ACTIONS_ATTR = "data-saved-pattern-sticky-nav-actions";
export const SAVED_PATTERN_HEADER_ID = "saved-pattern-header";

export type PatternInpageNavNecklinePiece = "back" | "front";

export type PatternInpageNavItem = {
  label: string;
  ids: readonly string[];
  discoverNecklinePiece?: PatternInpageNavNecklinePiece;
};

export type SyncPatternInpageNavOptions = {
  items: readonly PatternInpageNavItem[];
  nav?: Element | null;
  scope?: ParentNode | null;
  /** Sweater pages mount the print action once the TOC has at least one target. */
  onHasItems?: () => void;
};

let patternInpageNavScrollSpyBound = false;

function patternInpageNavScrollOffsetPx(nav: Element | null): number {
  const headerOffset =
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--site-header-offset"),
    ) || 112;
  const navHeight = nav instanceof HTMLElement ? nav.offsetHeight : 40;
  return headerOffset + navHeight + 6;
}

/**
 * Section slugs in sleeveless `flushOpenSection` are derived from `escapeHtml(row.title)`,
 * so titles containing `&` (e.g. `NECKLINE & SHOULDERS`) produce ids with `amp` in the slug.
 */
export function findNavTargetInScope(
  scope: ParentNode | null | undefined,
  ids: readonly string[],
  discoverNecklinePiece?: PatternInpageNavNecklinePiece,
): { el: HTMLElement; id: string } | null {
  if (!scope) return null;
  for (const id of ids) {
    let el = scope.querySelector(`#${CSS.escape(id)}`);
    if (!(el instanceof HTMLElement)) {
      el = scope.querySelector(`[data-section-id="${id}"]`);
    }
    if (el instanceof HTMLElement) {
      if (!el.id) el.id = id;
      return { el, id: el.id || id };
    }
  }
  if (discoverNecklinePiece === "back" || discoverNecklinePiece === "front") {
    const prefix = discoverNecklinePiece === "front" ? "sg-front-" : "sg-back-";
    const sections = scope.querySelectorAll(`section[data-section-id^="${prefix}"]`);
    for (const sec of sections) {
      if (!(sec instanceof HTMLElement)) continue;
      const sid = sec.getAttribute("data-section-id");
      if (!sid) continue;
      const lower = sid.toLowerCase();
      if (lower.includes("neckline") && lower.includes("shoulder")) {
        if (!sec.id) sec.id = sid;
        return { el: sec, id: sec.id || sid };
      }
    }
  }
  return null;
}

export function updatePatternInpageNavActivePill(): void {
  const nav = document.querySelector(`[${PATTERN_INPAGE_NAV_ATTR}]`);
  if (!(nav instanceof HTMLElement) || nav.hidden) return;
  const pills = nav.querySelectorAll(
    `a.${PATTERN_INPAGE_NAV_PILL_CLASS}[data-nav-section-id]`,
  );
  if (!pills.length) return;

  const offset = patternInpageNavScrollOffsetPx(nav);
  let activeId = pills[0]?.getAttribute("data-nav-section-id");
  for (const pill of pills) {
    if (!(pill instanceof HTMLAnchorElement)) continue;
    const id = pill.getAttribute("data-nav-section-id");
    if (!id) continue;
    const section = document.getElementById(id);
    if (!(section instanceof HTMLElement)) continue;
    if (section.getBoundingClientRect().top <= offset) {
      activeId = id;
    }
  }

  pills.forEach((pill) => {
    if (!(pill instanceof HTMLAnchorElement)) return;
    const id = pill.getAttribute("data-nav-section-id");
    const isActive = Boolean(id && id === activeId);
    pill.classList.toggle("is-active", isActive);
    if (isActive) pill.setAttribute("aria-current", "location");
    else pill.removeAttribute("aria-current");
  });
}

export function bindPatternInpageNavScrollSpy(): void {
  if (patternInpageNavScrollSpyBound) return;
  patternInpageNavScrollSpyBound = true;
  let ticking = false;
  const schedule = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      updatePatternInpageNavActivePill();
    });
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("hashchange", schedule);
  window.addEventListener("resize", schedule, { passive: true });
}

function patternStickyNavSectionsHost(nav: HTMLElement): HTMLElement {
  const existing = nav.querySelector(`[${PATTERN_INPAGE_NAV_SECTIONS_ATTR}]`);
  if (existing instanceof HTMLElement) return existing;
  const track = document.createElement("div");
  track.className = PATTERN_INPAGE_NAV_TRACK_CLASS;
  track.setAttribute(PATTERN_INPAGE_NAV_SECTIONS_ATTR, "");
  nav.replaceChildren(track);
  return track;
}

function patternStickyNavHasVisibleActions(nav: HTMLElement): boolean {
  const actions = nav.querySelector(`[${PATTERN_INPAGE_NAV_ACTIONS_ATTR}]`);
  if (!(actions instanceof HTMLElement)) return false;
  return [...actions.children].some((child) => child instanceof HTMLElement && !child.hidden);
}

/** Keep a jumped-to heading below the site header and this sticky bar. */
function syncPatternInpageNavOffset(nav: HTMLElement): void {
  const root = document.documentElement;
  if (!(root instanceof HTMLElement) || !root.style?.setProperty) return;
  const height = nav.offsetHeight;
  if (height > 0) {
    root.style.setProperty("--pattern-inpage-nav-height", `${height + 8}px`);
  }
}

/** Show or hide the shared Print control without leaving a second copy in the nav. */
export function setPatternPrintActionVisible(
  button: Element | null,
  visible: boolean,
): void {
  if (!(button instanceof HTMLElement)) return;
  button.hidden = !visible;
  button.style.display = visible ? "inline-flex" : "none";
}

/**
 * Bind the shared Print button. Pages that already render it pass their actions host;
 * a missing button is created once so older markup still prints.
 */
export function mountPatternPrintAction(options: {
  host: Element | null;
  visible?: boolean;
  onPrint: (button: HTMLButtonElement) => void;
}): HTMLButtonElement | null {
  if (!(options.host instanceof HTMLElement)) return null;
  let printBtn = options.host.querySelector("#print-btn");
  if (!(printBtn instanceof HTMLButtonElement)) {
    printBtn = document.createElement("button");
    printBtn.type = "button";
    printBtn.id = "print-btn";
    printBtn.className = "sleeveless-pattern-print-action no-print";
    printBtn.setAttribute("data-testid", "button-print");
    printBtn.setAttribute("aria-label", "Print pattern");
    printBtn.innerHTML = `<i class="fas fa-print" aria-hidden="true"></i> Print`;
    options.host.appendChild(printBtn);
  }
  if (printBtn.dataset.patternPrintBound !== "true") {
    printBtn.dataset.patternPrintBound = "true";
    const button = printBtn;
    printBtn.addEventListener("click", () => {
      options.onPrint(button);
    });
  }
  if (options.visible !== undefined) {
    setPatternPrintActionVisible(printBtn, options.visible);
  }
  return printBtn;
}

function scrollSavedPatternToTop(target: HTMLElement): void {
  const reduce =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const styles = getComputedStyle(document.documentElement);
  const headerOffset = parseFloat(styles.getPropertyValue("--header-offset")) || 170;
  const banner = parseFloat(styles.getPropertyValue("--kbm-env-banner-h")) || 0;
  const top =
    target.getBoundingClientRect().top + window.scrollY - banner - headerOffset - 8;
  window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
}

/** Smooth-scroll Top to the pattern header. Native hash navigation remains if the header is missing. */
export function bindPatternStickyNavTop(nav: ParentNode): void {
  const top = nav.querySelector("[data-saved-pattern-sticky-nav-top]");
  if (!(top instanceof HTMLElement) || typeof top.addEventListener !== "function") return;
  if (top.dataset.patternNavTopBound === "true") return;
  top.dataset.patternNavTopBound = "true";
  top.addEventListener("click", (event) => {
    const target = document.getElementById(SAVED_PATTERN_HEADER_ID);
    if (!(target instanceof HTMLElement)) return;
    event.preventDefault();
    scrollSavedPatternToTop(target);
  });
}

export function syncPatternInpageNav(options: SyncPatternInpageNavOptions): number {
  const nav = options.nav ?? document.querySelector(`[${PATTERN_INPAGE_NAV_ATTR}]`);
  if (!(nav instanceof HTMLElement)) return 0;
  bindPatternStickyNavTop(nav);
  const scope = options.scope ?? document.getElementById("pattern-content");
  const track = patternStickyNavSectionsHost(nav);
  track.className = PATTERN_INPAGE_NAV_TRACK_CLASS;
  track.replaceChildren();
  let count = 0;
  for (const item of options.items) {
    const found = findNavTargetInScope(scope, item.ids, item.discoverNecklinePiece);
    if (!found) continue;
    const a = document.createElement("a");
    a.href = `#${found.id}`;
    a.className = PATTERN_INPAGE_NAV_PILL_CLASS;
    a.dataset.navSectionId = found.id;
    a.textContent = item.label;
    track.appendChild(a);
    count += 1;
  }
  if (count > 0) {
    options.onHasItems?.();
  }
  nav.hidden = count === 0 && !patternStickyNavHasVisibleActions(nav);
  if (!nav.hidden) {
    bindPatternInpageNavScrollSpy();
    updatePatternInpageNavActivePill();
    syncPatternInpageNavOffset(nav);
  }
  return count;
}
