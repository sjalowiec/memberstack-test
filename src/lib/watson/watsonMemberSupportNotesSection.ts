import { initSortableTables } from "./sortableTable";
import { extractOrdersFragmentHtml } from "./watsonMemberOrdersSection";

export const SUPPORT_NOTES_SECTION_SHOW_LABEL = "Show support notes";
export const SUPPORT_NOTES_SECTION_HIDE_LABEL = "Hide support notes";

export function formatSupportNotesSectionHeading(noteCount: number): string {
  return `Support Notes (${noteCount})`;
}

export function buildSupportNotesFragmentUrl(memberid: string): string {
  return `/watson/members/${encodeURIComponent(memberid)}/support-notes-fragment`;
}

export type SupportNotesSectionElements = {
  toggle: HTMLButtonElement;
  panel: HTMLElement;
};

export function getSupportNotesSectionElements(section: HTMLElement): SupportNotesSectionElements | null {
  const toggle = section.querySelector<HTMLButtonElement>("[data-watson-support-notes-section-toggle]");
  const panel = section.querySelector<HTMLElement>("[data-watson-support-notes-panel]");
  if (!toggle || !panel) {
    return null;
  }
  return { toggle, panel };
}

export function setSupportNotesSectionExpanded(
  toggle: HTMLButtonElement,
  panel: HTMLElement,
  expanded: boolean,
): void {
  toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  toggle.textContent = expanded ? SUPPORT_NOTES_SECTION_HIDE_LABEL : SUPPORT_NOTES_SECTION_SHOW_LABEL;
  panel.hidden = !expanded;
}

export function isSupportNotesSectionExpanded(toggle: HTMLButtonElement): boolean {
  return toggle.getAttribute("aria-expanded") === "true";
}

export async function loadSupportNotesFragment(
  panel: HTMLElement,
  fragmentUrl: string,
  fetchHtml: typeof fetch = fetch,
): Promise<void> {
  if (panel.dataset.supportNotesLoaded === "true") {
    return;
  }

  const response = await fetchHtml(fragmentUrl, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(`Failed to load support notes (${response.status})`);
  }

  const html = await response.text();
  panel.innerHTML = extractOrdersFragmentHtml(html);
  panel.dataset.supportNotesLoaded = "true";
}

export function renderEmptySupportNotesPlaceholder(): string {
  return `<p class="watson__placeholder">No legacy admin notes found for this member.</p>
<p class="watson__placeholder">Editable Watson support notes are coming next.</p>`;
}

export function renderSupportNotesLoadError(): string {
  return '<p class="watson__status watson__status--error" role="alert">Unable to load support notes.</p>';
}

export function initMemberSupportNotesSection(
  section: HTMLElement,
  options: {
    noteCount: number;
    fragmentUrl: string;
    fetchHtml?: typeof fetch;
    initTable?: (root: ParentNode) => void;
  },
): void {
  const elements = getSupportNotesSectionElements(section);
  if (!elements) {
    return;
  }

  const { toggle, panel } = elements;
  const fetchHtml = options.fetchHtml ?? fetch;
  const initTable = options.initTable ?? (() => {});

  setSupportNotesSectionExpanded(toggle, panel, false);

  toggle.addEventListener("click", async () => {
    if (isSupportNotesSectionExpanded(toggle)) {
      setSupportNotesSectionExpanded(toggle, panel, false);
      return;
    }

    setSupportNotesSectionExpanded(toggle, panel, true);

    if (options.noteCount === 0) {
      if (panel.dataset.supportNotesLoaded !== "true") {
        panel.innerHTML = renderEmptySupportNotesPlaceholder();
        panel.dataset.supportNotesLoaded = "true";
      }
      return;
    }

    if (panel.dataset.supportNotesLoaded === "true") {
      return;
    }

    toggle.disabled = true;
    try {
      await loadSupportNotesFragment(panel, options.fragmentUrl, fetchHtml);
      initTable(panel);
    } catch {
      panel.innerHTML = renderSupportNotesLoadError();
      panel.dataset.supportNotesLoaded = "false";
    } finally {
      toggle.disabled = false;
    }
  });
}

export function initMemberSupportNotesSections(root: ParentNode = document): void {
  const sections = root.querySelectorAll<HTMLElement>("[data-watson-support-notes-section]");
  for (const section of sections) {
    const noteCount = Number.parseInt(section.dataset.noteCount ?? "0", 10);
    const fragmentUrl = section.dataset.supportNotesFragmentUrl;
    if (!fragmentUrl) {
      continue;
    }

    initMemberSupportNotesSection(section, {
      noteCount: Number.isNaN(noteCount) ? 0 : noteCount,
      fragmentUrl,
      initTable: (panel) => {
        initSortableTables(panel);
      },
    });
  }
}
