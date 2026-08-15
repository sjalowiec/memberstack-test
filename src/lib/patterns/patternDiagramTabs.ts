/**
 * Shared finished-pattern diagram tab container (Stitches & Rows / Shaping Notation).
 * Owns tab semantics, selected state, keyboard navigation, and the diagram panel shell.
 * Pattern families supply panel HTML; this module has no garment-specific branches.
 */

export const PATTERN_DIAGRAM_TAB_STS_ROWS = "sts-rows" as const;
export const PATTERN_DIAGRAM_TAB_SHAPING = "shaping-notation" as const;

export const PATTERN_DIAGRAM_TAB_IDS = [
  PATTERN_DIAGRAM_TAB_STS_ROWS,
  PATTERN_DIAGRAM_TAB_SHAPING,
] as const;

export type PatternDiagramTabId = (typeof PATTERN_DIAGRAM_TAB_IDS)[number];

export const PATTERN_DIAGRAM_TAB_LABELS: Record<PatternDiagramTabId, string> = {
  [PATTERN_DIAGRAM_TAB_STS_ROWS]: "Stitches & Rows",
  [PATTERN_DIAGRAM_TAB_SHAPING]: "Shaping Notation",
};

export const PATTERN_DIAGRAM_TABS_ROOT_ATTR = "data-pattern-diagram-tabs";
export const PATTERN_DIAGRAM_TAB_ATTR = "data-pattern-diagram-tab";
export const PATTERN_DIAGRAM_PANEL_ATTR = "data-pattern-diagram-panel";
export const PATTERN_DIAGRAM_TABS_INIT_ATTR = "data-pattern-diagram-tabs-init";
export const PATTERN_DIAGRAM_SHARED_PANEL_ATTR = "data-pattern-diagram-shared-panel";
export const PATTERN_DIAGRAM_SHARED_PANEL_ID = "shared";

export const PATTERN_DIAGRAM_TABS_CLASS = "pattern-diagram-tabs";
export const PATTERN_DIAGRAM_TABS_LIST_CLASS = "pattern-diagram-tabs__list";
export const PATTERN_DIAGRAM_TABS_TAB_CLASS = "pattern-diagram-tabs__tab";
export const PATTERN_DIAGRAM_TABS_PANEL_CLASS = "pattern-diagram-tabs__panel";

export type PatternDiagramTabSpec = {
  id: string;
  label?: string;
  /** Extra attributes on the tab button (family-specific data attrs). */
  extraTabAttrs?: string;
  extraTabClass?: string;
  /** Per-tab panel inner HTML. Ignored when `sharedPanel` is set. */
  panelHtml?: string;
  extraPanelAttrs?: string;
  extraPanelClass?: string;
  printHeading?: boolean;
};

export type BuildPatternDiagramTabsShellOptions = {
  idPrefix: string;
  tablistLabel: string;
  tabs: readonly PatternDiagramTabSpec[];
  selectedId?: string;
  extraRootClass?: string;
  extraRootAttrs?: string;
  extraListClass?: string;
  extraTabClass?: string;
  extraPanelClass?: string;
  testId?: string;
  tabTestIdPrefix?: string;
  panelTestIdPrefix?: string;
  /** Alias attributes copied onto each tab (e.g. family-specific selectors). */
  tabAttrAliases?: readonly string[];
  panelAttrAliases?: readonly string[];
  printHeadingClass?: string;
  /**
   * One diagram panel shared by all tabs. Families that swap generated content
   * in place (instead of showing/hiding panels) should use this.
   */
  sharedPanel?: boolean;
  sharedPanelHtml?: string;
};

export type PatternDiagramTabsBindOptions = {
  focus?: boolean;
  tabAttr?: string;
  panelAttr?: string;
  rootAttr?: string;
  initAttr?: string;
};

function escapeText(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function classNames(...parts: Array<string | undefined>): string {
  return parts
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function tabDomId(idPrefix: string, tabId: string): string {
  return `${idPrefix}-tab-${tabId}`;
}

function panelDomId(idPrefix: string, tabId: string): string {
  return `${idPrefix}-panel-${tabId}`;
}

function resolveTabAttr(options?: PatternDiagramTabsBindOptions): string {
  return options?.tabAttr ?? PATTERN_DIAGRAM_TAB_ATTR;
}

function resolvePanelAttr(options?: PatternDiagramTabsBindOptions): string {
  return options?.panelAttr ?? PATTERN_DIAGRAM_PANEL_ATTR;
}

function resolveRootAttr(options?: PatternDiagramTabsBindOptions): string {
  return options?.rootAttr ?? PATTERN_DIAGRAM_TABS_ROOT_ATTR;
}

function resolveInitAttr(options?: PatternDiagramTabsBindOptions): string {
  return options?.initAttr ?? PATTERN_DIAGRAM_TABS_INIT_ATTR;
}

function isElementLike(
  node: ParentNode | null | undefined,
): node is ParentNode & { getAttribute: (name: string) => string | null } {
  return (
    !!node &&
    typeof node === "object" &&
    "getAttribute" in node &&
    typeof (node as { getAttribute?: unknown }).getAttribute === "function"
  );
}

/**
 * Static shell HTML: tablist flush to a diagram content panel.
 * Pattern families inject generated diagram markup into the panel(s).
 */
export function buildPatternDiagramTabsShellHtml(
  options: BuildPatternDiagramTabsShellOptions,
): string {
  const tabs = options.tabs;
  if (!tabs.length) return "";

  const selectedId = options.selectedId ?? tabs[0]!.id;
  const sharedPanel = options.sharedPanel === true;
  const sharedPanelDomId = panelDomId(options.idPrefix, PATTERN_DIAGRAM_SHARED_PANEL_ID);
  const printHeadingClass =
    options.printHeadingClass ?? "pattern-diagram-tabs__print-heading";

  const tabsHtml = tabs
    .map((tab) => {
      const selected = tab.id === selectedId;
      const controlsId = sharedPanel
        ? sharedPanelDomId
        : panelDomId(options.idPrefix, tab.id);
      const label = tab.label ?? PATTERN_DIAGRAM_TAB_LABELS[tab.id as PatternDiagramTabId] ?? tab.id;
      const aliasAttrs = (options.tabAttrAliases ?? [])
        .map((attr) => ` ${attr}="${tab.id}"`)
        .join("");
      const testId = options.tabTestIdPrefix
        ? ` data-testid="${options.tabTestIdPrefix}-${tab.id}"`
        : "";
      return (
        `<button type="button"` +
        ` class="${classNames(PATTERN_DIAGRAM_TABS_TAB_CLASS, options.extraTabClass, tab.extraTabClass, selected ? "is-selected is-active" : "")}"` +
        ` role="tab"` +
        ` id="${tabDomId(options.idPrefix, tab.id)}"` +
        ` ${PATTERN_DIAGRAM_TAB_ATTR}="${tab.id}"` +
        aliasAttrs +
        ` aria-controls="${controlsId}"` +
        ` aria-selected="${selected ? "true" : "false"}"` +
        ` tabindex="${selected ? "0" : "-1"}"` +
        testId +
        (tab.extraTabAttrs ? ` ${tab.extraTabAttrs}` : "") +
        `>` +
        `${escapeText(label)}` +
        `</button>`
      );
    })
    .join("");

  const renderPanel = (tab: PatternDiagramTabSpec, selected: boolean): string => {
    const label = tab.label ?? PATTERN_DIAGRAM_TAB_LABELS[tab.id as PatternDiagramTabId] ?? tab.id;
    const aliasAttrs = (options.panelAttrAliases ?? [])
      .map((attr) => ` ${attr}="${tab.id}"`)
      .join("");
    const testId = options.panelTestIdPrefix
      ? ` data-testid="${options.panelTestIdPrefix}-${tab.id}"`
      : "";
    const heading =
      tab.printHeading === true
        ? `<h3 class="${printHeadingClass}">${escapeText(label)}</h3>`
        : "";
    return (
      `<div` +
      ` id="${panelDomId(options.idPrefix, tab.id)}"` +
      ` class="${classNames(PATTERN_DIAGRAM_TABS_PANEL_CLASS, options.extraPanelClass, tab.extraPanelClass)}"` +
      ` role="tabpanel"` +
      ` aria-labelledby="${tabDomId(options.idPrefix, tab.id)}"` +
      ` ${PATTERN_DIAGRAM_PANEL_ATTR}="${tab.id}"` +
      aliasAttrs +
      (selected ? "" : " hidden") +
      testId +
      (tab.extraPanelAttrs ? ` ${tab.extraPanelAttrs}` : "") +
      `>` +
      heading +
      (tab.panelHtml ?? "") +
      `</div>`
    );
  };

  let panelsHtml = "";
  if (sharedPanel) {
    const selectedTab = tabs.find((t) => t.id === selectedId) ?? tabs[0]!;
    const testId = options.panelTestIdPrefix
      ? ` data-testid="${options.panelTestIdPrefix}-${PATTERN_DIAGRAM_SHARED_PANEL_ID}"`
      : "";
    panelsHtml =
      `<div` +
      ` id="${sharedPanelDomId}"` +
      ` class="${classNames(PATTERN_DIAGRAM_TABS_PANEL_CLASS, options.extraPanelClass)}"` +
      ` role="tabpanel"` +
      ` aria-labelledby="${tabDomId(options.idPrefix, selectedTab.id)}"` +
      ` ${PATTERN_DIAGRAM_PANEL_ATTR}="${PATTERN_DIAGRAM_SHARED_PANEL_ID}"` +
      testId +
      `>` +
      (options.sharedPanelHtml ?? "") +
      `</div>`;
  } else {
    panelsHtml = tabs.map((tab) => renderPanel(tab, tab.id === selectedId)).join("");
  }

  const rootTestId = options.testId ? ` data-testid="${options.testId}"` : "";
  return (
    `<div class="${classNames(PATTERN_DIAGRAM_TABS_CLASS, options.extraRootClass)}"` +
    ` ${PATTERN_DIAGRAM_TABS_ROOT_ATTR}` +
    (sharedPanel ? ` ${PATTERN_DIAGRAM_SHARED_PANEL_ATTR}="true"` : "") +
    (options.extraRootAttrs ? ` ${options.extraRootAttrs}` : "") +
    rootTestId +
    `>` +
    `<div class="${classNames(PATTERN_DIAGRAM_TABS_LIST_CLASS, options.extraListClass, "no-print")}" role="tablist" aria-label="${escapeText(options.tablistLabel)}">` +
    tabsHtml +
    `</div>` +
    panelsHtml +
    `</div>`
  );
}

export function activatePatternDiagramTab(
  root: ParentNode,
  tabIdValue: string,
  options?: PatternDiagramTabsBindOptions,
): void {
  const tabAttr = resolveTabAttr(options);
  const panelAttr = resolvePanelAttr(options);
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>(`[${tabAttr}]`));
  const panels = Array.from(root.querySelectorAll<HTMLElement>(`[${panelAttr}]`));
  if (!tabs.length) return;

  const sharedPanel =
    isElementLike(root) &&
    root.getAttribute(PATTERN_DIAGRAM_SHARED_PANEL_ATTR) === "true";

  tabs.forEach((btn) => {
    const id = btn.getAttribute(tabAttr);
    const selected = id === tabIdValue;
    btn.setAttribute("aria-selected", selected ? "true" : "false");
    btn.tabIndex = selected ? 0 : -1;
    btn.classList.toggle("is-selected", selected);
    btn.classList.toggle("is-active", selected);
    if (selected && options?.focus) {
      btn.focus({ preventScroll: true });
    }
  });

  if (sharedPanel) {
    const shared = panels.find(
      (panel) => panel.getAttribute(panelAttr) === PATTERN_DIAGRAM_SHARED_PANEL_ID,
    );
    const selectedTab = tabs.find((btn) => btn.getAttribute(tabAttr) === tabIdValue);
    if (shared && selectedTab?.id) {
      shared.setAttribute("aria-labelledby", selectedTab.id);
    }
    return;
  }

  if (!panels.length) return;
  panels.forEach((panel) => {
    const id = panel.getAttribute(panelAttr);
    const selected = id === tabIdValue;
    if (selected) {
      panel.removeAttribute("hidden");
    } else {
      panel.setAttribute("hidden", "");
    }
  });
}

/**
 * Bind click + keyboard navigation once per tabs root.
 * Keyboard: arrows / Home / End. Enter/Space activate the focused tab.
 */
export function initPatternDiagramTabs(
  root: ParentNode = document,
  options?: PatternDiagramTabsBindOptions,
): void {
  const rootAttr = resolveRootAttr(options);
  const tabAttr = resolveTabAttr(options);
  const initAttr = resolveInitAttr(options);
  const shells = Array.from(root.querySelectorAll<HTMLElement>(`[${rootAttr}]`));
  for (const shell of shells) {
    if (shell.getAttribute(initAttr) === "true") continue;
    shell.setAttribute(initAttr, "true");

    const tabs = Array.from(shell.querySelectorAll<HTMLButtonElement>(`[${tabAttr}]`));
    if (!tabs.length) continue;

    const initiallySelected =
      tabs.find((btn) => btn.getAttribute("aria-selected") === "true")?.getAttribute(tabAttr) ??
      tabs[0]?.getAttribute(tabAttr);
    if (initiallySelected) {
      activatePatternDiagramTab(shell, initiallySelected, options);
    }

    tabs.forEach((btn, idx) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute(tabAttr);
        if (id) activatePatternDiagramTab(shell, id, options);
      });

      btn.addEventListener("keydown", (e: KeyboardEvent) => {
        const key = e.key;
        if (key === "Enter" || key === " ") {
          e.preventDefault();
          const id = btn.getAttribute(tabAttr);
          if (id) activatePatternDiagramTab(shell, id, options);
          return;
        }
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return;
        e.preventDefault();
        let nextIdx = idx;
        if (key === "ArrowLeft") {
          nextIdx = (idx - 1 + tabs.length) % tabs.length;
        } else if (key === "ArrowRight") {
          nextIdx = (idx + 1) % tabs.length;
        } else if (key === "Home") {
          nextIdx = 0;
        } else if (key === "End") {
          nextIdx = tabs.length - 1;
        }
        const next = tabs[nextIdx];
        const nextId = next?.getAttribute(tabAttr);
        if (next && nextId) {
          activatePatternDiagramTab(shell, nextId, { ...options, focus: true });
          if (typeof next.click === "function") {
            next.click();
          }
        }
      });
    });
  }
}
