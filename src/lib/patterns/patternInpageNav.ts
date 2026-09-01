/**
 * Shared finished-pattern in-page section navigation (sticky pill TOC).
 * Sweater and Socks pages use the same markup contract, CSS, scroll-spy, and jump behavior.
 */

export const PATTERN_INPAGE_NAV_ATTR = "data-sleeveless-pattern-inpage-nav";
export const PATTERN_INPAGE_NAV_TRACK_CLASS = "sleeveless-pattern-inpage-nav__track";
export const PATTERN_INPAGE_NAV_PILL_CLASS = "sleeveless-pattern-inpage-nav__pill";

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
    if (el instanceof HTMLElement) return { el, id: el.id || id };
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
}

export function syncPatternInpageNav(options: SyncPatternInpageNavOptions): number {
  const nav = options.nav ?? document.querySelector(`[${PATTERN_INPAGE_NAV_ATTR}]`);
  if (!(nav instanceof HTMLElement)) return 0;
  const scope = options.scope ?? document.getElementById("pattern-content");
  const track = document.createElement("div");
  track.className = PATTERN_INPAGE_NAV_TRACK_CLASS;
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
  nav.replaceChildren(track);
  nav.hidden = count === 0;
  if (count > 0) {
    bindPatternInpageNavScrollSpy();
    updatePatternInpageNavActivePill();
  }
  return count;
}
