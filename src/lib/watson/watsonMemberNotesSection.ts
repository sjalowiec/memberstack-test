import { extractOrdersFragmentHtml } from "./watsonMemberOrdersSection";
import { initWatsonNotesPanel } from "./watsonMemberWatsonNotesSection";

export const MEMBER_NOTES_SECTION_SHOW_LABEL = "Show notes";
export const MEMBER_NOTES_SECTION_HIDE_LABEL = "Hide notes";

export function formatMemberNotesSectionHeading(
  legacyNoteCount: number,
  watsonNoteCount: number,
): string {
  return `Member Notes (${legacyNoteCount} legacy, ${watsonNoteCount} Watson)`;
}

export function buildLegacyNotesFragmentUrl(memberid: string): string {
  return `/watson/members/${encodeURIComponent(memberid)}/legacy-notes-fragment`;
}

export function buildWatsonNotesFragmentUrl(memberid: string): string {
  return `/watson/members/${encodeURIComponent(memberid)}/watson-notes-fragment`;
}

export function renderEmptyLegacyNotesPlaceholder(): string {
  return '<p class="watson__placeholder">No legacy admin notes found for this member.</p>';
}

export function renderNotesLoadError(message: string): string {
  return `<p class="watson__status watson__status--error" role="alert">${escapeHtml(message)}</p>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type MemberNotesSectionElements = {
  toggle: HTMLButtonElement;
  panel: HTMLElement;
  legacyPanel: HTMLElement;
  watsonPanel: HTMLElement;
};

export function getMemberNotesSectionElements(
  section: HTMLElement,
): MemberNotesSectionElements | null {
  const toggle = section.querySelector<HTMLButtonElement>(
    "[data-watson-member-notes-section-toggle]",
  );
  const panel = section.querySelector<HTMLElement>("[data-watson-member-notes-panel]");
  const legacyPanel = section.querySelector<HTMLElement>("[data-watson-legacy-notes-panel]");
  const watsonPanel = section.querySelector<HTMLElement>("[data-watson-watson-notes-panel]");
  if (!toggle || !panel || !legacyPanel || !watsonPanel) {
    return null;
  }
  return { toggle, panel, legacyPanel, watsonPanel };
}

export function setMemberNotesSectionExpanded(
  toggle: HTMLButtonElement,
  panel: HTMLElement,
  expanded: boolean,
): void {
  toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  toggle.textContent = expanded ? MEMBER_NOTES_SECTION_HIDE_LABEL : MEMBER_NOTES_SECTION_SHOW_LABEL;
  panel.hidden = !expanded;
}

export function isMemberNotesSectionExpanded(toggle: HTMLButtonElement): boolean {
  return toggle.getAttribute("aria-expanded") === "true";
}

export async function loadNotesFragment(
  panel: HTMLElement,
  fragmentUrl: string,
  datasetKey: string,
  fetchHtml: typeof fetch = fetch,
): Promise<void> {
  if (panel.dataset[datasetKey] === "true") {
    return;
  }

  const response = await fetchHtml(fragmentUrl, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(`Failed to load notes (${response.status})`);
  }

  const html = await response.text();
  panel.innerHTML = extractOrdersFragmentHtml(html);
  panel.dataset[datasetKey] = "true";
}

export async function reloadWatsonNotesFragment(
  panel: HTMLElement,
  fragmentUrl: string,
  fetchHtml: typeof fetch = fetch,
): Promise<void> {
  panel.dataset.watsonNotesLoaded = "false";
  await loadNotesFragment(panel, fragmentUrl, "watsonNotesLoaded", fetchHtml);
  const root = panel.querySelector<HTMLElement>("[data-watson-notes-root]");
  if (root) {
    initWatsonNotesPanel(root, {
      onNotesChanged: async () => {
        await reloadWatsonNotesFragment(panel, fragmentUrl, fetchHtml);
      },
      fragmentUrl,
      fetchHtml,
    });
  }
}

export function initMemberNotesSection(
  section: HTMLElement,
  options: {
    legacyNoteCount: number;
    legacyFragmentUrl: string;
    watsonFragmentUrl: string;
    fetchHtml?: typeof fetch;
  },
): void {
  const elements = getMemberNotesSectionElements(section);
  if (!elements) {
    return;
  }

  const { toggle, panel, legacyPanel, watsonPanel } = elements;
  const fetchHtml = options.fetchHtml ?? fetch;

  setMemberNotesSectionExpanded(toggle, panel, false);

  toggle.addEventListener("click", async () => {
    if (isMemberNotesSectionExpanded(toggle)) {
      setMemberNotesSectionExpanded(toggle, panel, false);
      return;
    }

    setMemberNotesSectionExpanded(toggle, panel, true);
    toggle.disabled = true;

    try {
      const loads: Promise<void>[] = [];

      if (options.legacyNoteCount === 0) {
        if (legacyPanel.dataset.legacyNotesLoaded !== "true") {
          legacyPanel.innerHTML = renderEmptyLegacyNotesPlaceholder();
          legacyPanel.dataset.legacyNotesLoaded = "true";
        }
      } else {
        loads.push(
          loadNotesFragment(legacyPanel, options.legacyFragmentUrl, "legacyNotesLoaded", fetchHtml),
        );
      }

      loads.push(
        reloadWatsonNotesFragment(watsonPanel, options.watsonFragmentUrl, fetchHtml),
      );

      await Promise.all(loads);
    } catch {
      if (legacyPanel.dataset.legacyNotesLoaded !== "true") {
        legacyPanel.innerHTML = renderNotesLoadError("Unable to load legacy notes.");
      }
      if (watsonPanel.dataset.watsonNotesLoaded !== "true") {
        watsonPanel.innerHTML = renderNotesLoadError("Unable to load Watson notes.");
      }
    } finally {
      toggle.disabled = false;
    }
  });
}

export function initMemberNotesSections(root: ParentNode = document): void {
  const sections = root.querySelectorAll<HTMLElement>("[data-watson-member-notes-section]");
  for (const section of sections) {
    const legacyNoteCount = Number.parseInt(section.dataset.legacyNoteCount ?? "0", 10);
    const legacyFragmentUrl = section.dataset.legacyNotesFragmentUrl;
    const watsonFragmentUrl = section.dataset.watsonNotesFragmentUrl;
    if (!legacyFragmentUrl || !watsonFragmentUrl) {
      continue;
    }

    initMemberNotesSection(section, {
      legacyNoteCount: Number.isNaN(legacyNoteCount) ? 0 : legacyNoteCount,
      legacyFragmentUrl,
      watsonFragmentUrl,
    });
  }
}
