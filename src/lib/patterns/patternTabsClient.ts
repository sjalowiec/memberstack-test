export type PatternTabName = "build" | "pattern" | "share" | "inspiration";

export interface PatternTabsControl {
  activateTab: (name: PatternTabName) => void;
}

/** Activate a tab inside a `.pattern-tabs` root (Pinterest side effects included). */
export function applyPatternTabsActivation(tabsRoot: Element, target: PatternTabName): void {
  const panel = tabsRoot.querySelector<HTMLElement>(`#tab-${target}`);
  if (!panel) return;

  const tabControls = tabsRoot.querySelectorAll<HTMLElement>(".pattern-tab-nav .tab-btn");
  tabControls.forEach((btn) => {
    const tab = btn.dataset.tab as PatternTabName | undefined;
    if (!tab) return;
    btn.classList.toggle("active", tab === target);
  });
  const tabPanels = tabsRoot.querySelectorAll<HTMLElement>(".pattern-tab-content .tab-panel");
  tabPanels.forEach((p) => {
    p.classList.toggle("active", p.id === `tab-${target}`);
  });

  if (target === "inspiration") {
    const win = window as Window &
      typeof globalThis & {
        PinUtils?: { build?: (r?: Document | Element | null) => void };
        kbmSchedulePinterestEmbedsRefresh?: (root?: Document | Element | null) => void;
      };
    if (win.PinUtils && typeof win.PinUtils.build === "function") {
      win.PinUtils.build();
    }
    win.kbmSchedulePinterestEmbedsRefresh?.();
  }
}

/**
 * Mark generated pattern output as ready to show (vs shared empty state).
 * Only affects roots with class `pattern-tabs--pattern-managed`.
 * Call from each wizard when your page-specific readiness predicate becomes true/false
 * (or toggle `pattern-tabs--pattern-ready` on the same root).
 */
export function setPatternTabsReadiness(tabsRoot: Element | null | undefined, ready: boolean): void {
  if (!tabsRoot) return;
  if (!tabsRoot.classList.contains("pattern-tabs--pattern-managed")) return;
  tabsRoot.classList.toggle("pattern-tabs--pattern-ready", ready);
}

let goBuildDelegationBound = false;

/** Buttons that switch to the Create (inputs) tab inside managed Pattern panels. */
export function bindPatternTabsGoBuildDelegation(): void {
  if (goBuildDelegationBound) return;
  goBuildDelegationBound = true;
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const btn = t.closest<HTMLElement>("[data-pattern-tabs-go-build]");
    if (!btn) return;
    const root = btn.closest(".pattern-tabs");
    if (!root) return;
    e.preventDefault();
    applyPatternTabsActivation(root, "build");
  });
}

let patternTabsSharedInit = false;

/** Run once on pages that use PatternTabs: go-to-create-tab delegation. */
export function initPatternTabsGlobalBehaviors(): void {
  if (patternTabsSharedInit) return;
  patternTabsSharedInit = true;
  bindPatternTabsGoBuildDelegation();
}

/**
 * Wire tab buttons/panels inside a `.pattern-tabs` root. Returns `activateTab` for programmatic switches.
 * Multiple instances: pass the specific `.pattern-tabs` element as `root`.
 * Idempotent: safe to call again on the same root.
 */
export function initPatternTabs(root: ParentNode | null | undefined): PatternTabsControl | null {
  const tabsRoot =
    root &&
    (root instanceof Element && root.classList.contains("pattern-tabs")
      ? root
      : root.querySelector(".pattern-tabs"));

  if (!(tabsRoot instanceof Element)) return null;

  if (tabsRoot.getAttribute("data-pattern-tabs-bound") === "1") {
    return {
      activateTab: (name: PatternTabName) => applyPatternTabsActivation(tabsRoot, name),
    };
  }
  tabsRoot.setAttribute("data-pattern-tabs-bound", "1");

  const tabButtons = tabsRoot.querySelectorAll(".pattern-tab-nav .tab-btn");

  tabButtons.forEach((el) => {
    if (!(el instanceof HTMLButtonElement)) return;
    el.addEventListener("click", () => {
      const isDisabled = el.classList.contains("is-disabled");
      const tab = el.dataset.tab as PatternTabName | undefined;
      if (isDisabled && tab !== "pattern") return;
      if (!tab) return;
      applyPatternTabsActivation(tabsRoot, tab);
    });
  });

  return {
    activateTab: (name: PatternTabName) => applyPatternTabsActivation(tabsRoot, name),
  };
}
