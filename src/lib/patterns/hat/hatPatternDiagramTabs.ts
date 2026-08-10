/**
 * Accessible tabbed hat diagram shell (Stitches & Rows + Shaping Notation).
 * Keyboard behavior mirrors PatternLayout tablist (arrows / Home / End).
 */

import { buildHatShapingNotationHelpHtml } from "./hatShapingNotationHelp";

export const HAT_DIAGRAM_TAB_STS_ROWS = "sts-rows" as const;
export const HAT_DIAGRAM_TAB_SHAPING = "shaping-notation" as const;

/** @deprecated Use {@link HAT_DIAGRAM_TAB_SHAPING}. */
export const HAT_DIAGRAM_TAB_JAPANESE = HAT_DIAGRAM_TAB_SHAPING;

export type HatDiagramTabId =
  | typeof HAT_DIAGRAM_TAB_STS_ROWS
  | typeof HAT_DIAGRAM_TAB_SHAPING;

export const HAT_DIAGRAM_TAB_IDS: readonly HatDiagramTabId[] = [
  HAT_DIAGRAM_TAB_STS_ROWS,
  HAT_DIAGRAM_TAB_SHAPING,
] as const;

export const HAT_DIAGRAM_TAB_LABELS: Record<HatDiagramTabId, string> = {
  [HAT_DIAGRAM_TAB_STS_ROWS]: "Stitches & Rows",
  [HAT_DIAGRAM_TAB_SHAPING]: "Shaping Notation",
};

const TAB_ATTR = "data-hat-diagram-tab";
const PANEL_ATTR = "data-hat-diagram-panel";
const ROOT_ATTR = "data-hat-diagram-tabs";
const INIT_ATTR = "data-hat-diagram-tabs-init";

function escapeText(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function tabDomId(tab: HatDiagramTabId): string {
  return `hat-diagram-tab-${tab}`;
}

function panelDomId(tab: HatDiagramTabId): string {
  return `hat-diagram-panel-${tab}`;
}

/**
 * Static shell HTML for the diagram panel. SVG hosts are filled by the pattern page.
 */
export function buildHatPatternDiagramTabsShellHtml(): string {
  const helpHtml = buildHatShapingNotationHelpHtml();

  const tabsHtml = HAT_DIAGRAM_TAB_IDS.map((id, index) => {
    const selected = index === 0;
    return (
      `<button type="button"` +
      ` class="hat-pattern-diagram-tabs__tab"` +
      ` role="tab"` +
      ` id="${tabDomId(id)}"` +
      ` ${TAB_ATTR}="${id}"` +
      ` aria-controls="${panelDomId(id)}"` +
      ` aria-selected="${selected ? "true" : "false"}"` +
      ` tabindex="${selected ? "0" : "-1"}"` +
      ` data-testid="hat-diagram-tab-${id}">` +
      `${escapeText(HAT_DIAGRAM_TAB_LABELS[id])}` +
      `</button>`
    );
  }).join("");

  const stsPanel =
    `<div` +
    ` id="${panelDomId(HAT_DIAGRAM_TAB_STS_ROWS)}"` +
    ` class="hat-pattern-diagram-tabs__panel"` +
    ` role="tabpanel"` +
    ` aria-labelledby="${tabDomId(HAT_DIAGRAM_TAB_STS_ROWS)}"` +
    ` ${PANEL_ATTR}="${HAT_DIAGRAM_TAB_STS_ROWS}"` +
    ` data-testid="hat-diagram-panel-sts-rows">` +
    `<h3 class="hat-pattern-diagram-print-heading">${escapeText(HAT_DIAGRAM_TAB_LABELS[HAT_DIAGRAM_TAB_STS_ROWS])}</h3>` +
    `<div class="hat-pattern-diagram-panel__svg" data-hat-diagram-sts-rows-host data-hat-diagram-host></div>` +
    `</div>`;

  const shapingPanel =
    `<div` +
    ` id="${panelDomId(HAT_DIAGRAM_TAB_SHAPING)}"` +
    ` class="hat-pattern-diagram-tabs__panel"` +
    ` role="tabpanel"` +
    ` aria-labelledby="${tabDomId(HAT_DIAGRAM_TAB_SHAPING)}"` +
    ` ${PANEL_ATTR}="${HAT_DIAGRAM_TAB_SHAPING}"` +
    ` hidden` +
    ` data-testid="hat-diagram-panel-shaping-notation">` +
    `<h3 class="hat-pattern-diagram-print-heading">${escapeText(HAT_DIAGRAM_TAB_LABELS[HAT_DIAGRAM_TAB_SHAPING])}</h3>` +
    helpHtml +
    `<div class="hat-pattern-diagram-panel__svg" data-hat-diagram-shaping-host></div>` +
    `</div>`;

  return (
    `<div class="hat-pattern-diagram-tabs" ${ROOT_ATTR} data-testid="hat-diagram-tabs">` +
    `<div class="hat-pattern-diagram-tabs__list no-print" role="tablist" aria-label="Hat diagram view">` +
    tabsHtml +
    `</div>` +
    stsPanel +
    shapingPanel +
    `</div>`
  );
}

export function activateHatDiagramTab(
  root: ParentNode,
  tabIdValue: HatDiagramTabId,
  options?: { focus?: boolean },
): void {
  const tabs = Array.from(
    root.querySelectorAll<HTMLButtonElement>(`[${TAB_ATTR}]`),
  );
  const panels = Array.from(
    root.querySelectorAll<HTMLElement>(`[${PANEL_ATTR}]`),
  );
  if (!tabs.length || !panels.length) return;

  tabs.forEach((btn) => {
    const id = btn.getAttribute(TAB_ATTR) as HatDiagramTabId | null;
    const selected = id === tabIdValue;
    btn.setAttribute("aria-selected", selected ? "true" : "false");
    btn.tabIndex = selected ? 0 : -1;
    btn.classList.toggle("is-selected", selected);
    if (selected && options?.focus) {
      btn.focus({ preventScroll: true });
    }
  });

  panels.forEach((panel) => {
    const id = panel.getAttribute(PANEL_ATTR) as HatDiagramTabId | null;
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
 */
export function initHatPatternDiagramTabs(root: ParentNode = document): void {
  const shells = Array.from(
    root.querySelectorAll<HTMLElement>(`[${ROOT_ATTR}]`),
  );
  for (const shell of shells) {
    if (shell.getAttribute(INIT_ATTR) === "true") continue;
    shell.setAttribute(INIT_ATTR, "true");

    const tabs = Array.from(
      shell.querySelectorAll<HTMLButtonElement>(`[${TAB_ATTR}]`),
    );
    if (!tabs.length) continue;

    activateHatDiagramTab(shell, HAT_DIAGRAM_TAB_STS_ROWS);

    tabs.forEach((btn, idx) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute(TAB_ATTR) as HatDiagramTabId | null;
        if (id) activateHatDiagramTab(shell, id);
      });

      btn.addEventListener("keydown", (e: KeyboardEvent) => {
        const key = e.key;
        if (key === "Enter" || key === " ") {
          e.preventDefault();
          const id = btn.getAttribute(TAB_ATTR) as HatDiagramTabId | null;
          if (id) activateHatDiagramTab(shell, id);
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
        const nextId = next?.getAttribute(TAB_ATTR) as HatDiagramTabId | null;
        if (next && nextId) {
          activateHatDiagramTab(shell, nextId, { focus: true });
        }
      });
    });
  }
}
