import { initSortableTables } from "./sortableTable";
import { extractOrdersFragmentHtml } from "./watsonMemberOrdersSection";

export const SAVED_PATTERNS_SECTION_SHOW_LABEL = "Show saved patterns";
export const SAVED_PATTERNS_SECTION_HIDE_LABEL = "Hide saved patterns";

export function formatSavedPatternsSectionHeading(recordCount: number): string {
  return `Saved Patterns (${recordCount})`;
}

export function buildSavedPatternsFragmentUrl(memberid: string): string {
  return `/watson/members/${encodeURIComponent(memberid)}/saved-patterns-fragment`;
}

export type SavedPatternsSectionElements = {
  toggle: HTMLButtonElement;
  panel: HTMLElement;
};

export function getSavedPatternsSectionElements(
  section: HTMLElement,
): SavedPatternsSectionElements | null {
  const toggle = section.querySelector<HTMLButtonElement>("[data-watson-saved-patterns-section-toggle]");
  const panel = section.querySelector<HTMLElement>("[data-watson-saved-patterns-panel]");
  if (!toggle || !panel) {
    return null;
  }
  return { toggle, panel };
}

export function setSavedPatternsSectionExpanded(
  toggle: HTMLButtonElement,
  panel: HTMLElement,
  expanded: boolean,
): void {
  toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  toggle.textContent = expanded ? SAVED_PATTERNS_SECTION_HIDE_LABEL : SAVED_PATTERNS_SECTION_SHOW_LABEL;
  panel.hidden = !expanded;
}

export function isSavedPatternsSectionExpanded(toggle: HTMLButtonElement): boolean {
  return toggle.getAttribute("aria-expanded") === "true";
}

export async function loadSavedPatternsFragment(
  panel: HTMLElement,
  fragmentUrl: string,
  fetchHtml: typeof fetch = fetch,
): Promise<void> {
  if (panel.dataset.savedPatternsLoaded === "true") {
    return;
  }

  const response = await fetchHtml(fragmentUrl, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(`Failed to load saved patterns (${response.status})`);
  }

  const html = await response.text();
  panel.innerHTML = extractOrdersFragmentHtml(html);
  panel.dataset.savedPatternsLoaded = "true";
}

export function renderEmptySavedPatternsPlaceholder(): string {
  return '<p class="watson__placeholder">No saved pattern records found for this member.</p>';
}

export function renderSavedPatternsLoadError(): string {
  return '<p class="watson__status watson__status--error" role="alert">Unable to load saved patterns.</p>';
}

export function initMemberSavedPatternsSection(
  section: HTMLElement,
  options: {
    recordCount: number;
    fragmentUrl: string;
    fetchHtml?: typeof fetch;
    initTable?: (root: ParentNode) => void;
  },
): void {
  const elements = getSavedPatternsSectionElements(section);
  if (!elements) {
    return;
  }

  const { toggle, panel } = elements;
  const fetchHtml = options.fetchHtml ?? fetch;
  const initTable = options.initTable ?? (() => {});

  setSavedPatternsSectionExpanded(toggle, panel, false);

  toggle.addEventListener("click", async () => {
    if (isSavedPatternsSectionExpanded(toggle)) {
      setSavedPatternsSectionExpanded(toggle, panel, false);
      return;
    }

    setSavedPatternsSectionExpanded(toggle, panel, true);

    if (options.recordCount === 0) {
      if (panel.dataset.savedPatternsLoaded !== "true") {
        panel.innerHTML = renderEmptySavedPatternsPlaceholder();
        panel.dataset.savedPatternsLoaded = "true";
      }
      return;
    }

    if (panel.dataset.savedPatternsLoaded === "true") {
      return;
    }

    toggle.disabled = true;
    try {
      await loadSavedPatternsFragment(panel, options.fragmentUrl, fetchHtml);
      initTable(panel);
    } catch {
      panel.innerHTML = renderSavedPatternsLoadError();
      panel.dataset.savedPatternsLoaded = "false";
    } finally {
      toggle.disabled = false;
    }
  });
}

export function initMemberSavedPatternsSections(root: ParentNode = document): void {
  const sections = root.querySelectorAll<HTMLElement>("[data-watson-saved-patterns-section]");
  for (const section of sections) {
    const recordCount = Number.parseInt(section.dataset.recordCount ?? "0", 10);
    const fragmentUrl = section.dataset.savedPatternsFragmentUrl;
    if (!fragmentUrl) {
      continue;
    }

    initMemberSavedPatternsSection(section, {
      recordCount: Number.isNaN(recordCount) ? 0 : recordCount,
      fragmentUrl,
      initTable: (panel) => {
        initSortableTables(panel);
      },
    });
  }
}
